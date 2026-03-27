// ═══════════════════════════════════════════════════════════════════════
//  REACTIVE CONTEXT (FINE-GRAINED)
// ═══════════════════════════════════════════════════════════════════════

import { _ctxRegistry, _devtoolsEmit } from "./devtools.js";
import {
	_config,
	_currentEl,
	_globals,
	_refs,
	_routerInstance,
	_stores,
} from "./globals.js";
import { _i18n } from "./i18n.js";

let _batchDepth = 0;
const _batchQueue = new Set();
let _ctxId = 0;
let _ctxGeneration = 0;

// Global state for dependency tracking
export let _activeEffect = null;

export function _resetCtxId() {
	_ctxId = 0;
}

export function _startBatch() {
	_batchDepth++;
	_devtoolsEmit("batch:start", { depth: _batchDepth });
}

export function _endBatch() {
	_batchDepth--;
	if (_batchDepth === 0 && _batchQueue.size > 0) {
		_devtoolsEmit("batch:end", { depth: 0, queueSize: _batchQueue.size });
		const fns = [..._batchQueue];
		_batchQueue.clear();
		fns.forEach((fn) => {
			if (fn._el && !fn._el.isConnected) return;
			fn();
		});
	}
}

/**
 * Execute a function and track which reactive keys it accesses.
 */
export function _withEffect(fn, effect) {
	const prev = _activeEffect;
	_activeEffect = effect;
	try {
		return fn();
	} finally {
		_activeEffect = prev;
	}
}

export function createContext(data = {}, parent = null) {
	// listeners: Map<key, Set<fn>>
	// key '*' is for global listeners (catch-all)
	const listeners = new Map();
	listeners.set("*", new Set());

	const raw = {};
	Object.assign(raw, data);
	if (_config.devtools) raw.__devtoolsId = ++_ctxId;
	let notifying = false;

	function getListenersForKey(key) {
		const sets = [];
		const globalSet = listeners.get("*");
		if (globalSet) sets.push(globalSet);
		
		if (key && key !== "*") {
			const specific = listeners.get(key);
			if (specific) sets.push(specific);
		}
		return sets;
	}

	function notify(key = "*") {
		if (notifying) return;
		notifying = true;
		try {
			const setsToNotify = key === "*" 
				? Array.from(listeners.values())
				: getListenersForKey(key);

			for (const set of setsToNotify) {
				if (!set) continue;
				for (const fn of set) {
					if (fn._el && !fn._el.isConnected) {
						set.delete(fn);
						continue;
					}
					if (_batchDepth > 0) {
						_batchQueue.add(fn);
					} else {
						fn();
					}
				}
			}
		} finally {
			notifying = false;
		}
	}

	const handler = {
		get(target, key) {
			if (key === "__isProxy") return true;
			if (key === "__raw") return target;
			if (key === "__listeners") return listeners;
			
			if (key === "$watch")
				return (keyOrFn, maybeFn) => {
					let k = "*";
					let fn = keyOrFn;
					
					if (typeof keyOrFn === "string" && typeof maybeFn === "function") {
						k = keyOrFn;
						fn = maybeFn;
					}

					if (_currentEl) fn._el = _currentEl;
					
					if (!listeners.has(k)) listeners.set(k, new Set());
					listeners.get(k).add(fn);
					
					return () => {
						const set = listeners.get(k);
						if (set) set.delete(fn);
					};
				};

			if (key === "$notify") return notify;
			
			if (key === "$set")
				return (k, v) => {
					const parts = k.split(".");
					if (parts.length === 1) {
						proxy[k] = v;
					} else {
						let obj = proxy;
						for (let i = 0; i < parts.length - 1; i++) {
							obj = obj[parts[i]];
							if (obj == null) return;
						}
						const lastKey = parts[parts.length - 1];
						const old = obj[lastKey];
						obj[lastKey] = v;
						if (old !== v) notify(parts[0]);
					}
				};

			if (key === "$parent") return parent;
			if (key === "$refs") return target.$refs ?? _refs;
			if (key === "$store") return _stores;
			if (key === "$route")
				return _routerInstance ? _routerInstance.current : {};
			if (key === "$router") return _routerInstance;
			if (key === "$i18n") return _i18n;
			if (key === "$form") return target.$form || null;
			
			if (typeof key === "string" && key.startsWith("$") && key.slice(1) in _globals) {
				return _globals[key.slice(1)];
			}

			// Automatic dependency tracking
			if (_activeEffect && typeof key === "string" && !key.startsWith("$")) {
				if (!listeners.has(key)) listeners.set(key, new Set());
				listeners.get(key).add(_activeEffect);
			}

			if (key in target) return target[key];
			if (parent?.__isProxy) return parent[key];
			return undefined;
		},
		set(target, key, value) {
			const old = target[key];
			target[key] = value;
			if (old !== value) {
				_ctxGeneration++;
				if (typeof key === "string") notify(key);
				else notify("*");
				
				_devtoolsEmit("ctx:updated", {
					id: target.__devtoolsId,
					key,
					oldValue: old,
					newValue: value,
				});
			}
			return true;
		},
		has(target, key) {
			if (key in target) return true;
			if (typeof key === "string" && key.startsWith("$")) {
				const builtins = new Set([
					"$watch", "$notify", "$set", "$parent", "$refs",
					"$store", "$route", "$router", "$i18n", "$form",
				]);
				if (builtins.has(key)) return true;
				if (key.slice(1) in _globals) return true;
			}
			if (parent?.__isProxy) return key in parent;
			return false;
		},
	};

	const proxy = new Proxy(raw, handler);

	if (_config.devtools && raw.__devtoolsId) {
		_ctxRegistry.set(raw.__devtoolsId, proxy);
		_devtoolsEmit("ctx:created", {
			id: raw.__devtoolsId,
			parentId: parent?.__raw?.__devtoolsId ?? null,
			keys: Object.keys(data),
			elementTag: _currentEl?.tagName?.toLowerCase() ?? null,
		});
	}

	return proxy;
}

// Collect all keys from a context + its parent chain
export function _collectKeys(ctx) {
	const cache = ctx.__raw.__collectKeysCache;
	if (cache && cache.gen === _ctxGeneration) return cache.result;

	const allKeys = new Set();
	const allVals = {};
	let c = ctx;
	while (c?.__isProxy) {
		const raw = c.__raw;
		for (const k of Object.keys(raw)) {
			if (!allKeys.has(k)) {
				allKeys.add(k);
				allVals[k] = raw[k];
			}
		}
		c = c.$parent;
	}
	const result = { keys: [...allKeys], vals: allVals };
	ctx.__raw.__collectKeysCache = { gen: _ctxGeneration, result };
	return result;
}
