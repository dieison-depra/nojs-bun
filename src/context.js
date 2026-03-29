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
import { createEffect, createSignal } from "./signals.js";

let _batchDepth = 0;
const _batchQueue = new Set();
let _ctxId = 0;
let _ctxGeneration = 0;

function _isEffectDead(fn) {
	if (fn._elRef) {
		const el = fn._elRef.deref();
		return !el || !el.isConnected;
	}
	return fn._el ? !fn._el.isConnected : false;
}

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
			if (_isEffectDead(fn)) return;
			fn();
		});
	}
}

/**
 * Execute a function and track which reactive keys it accesses.
 * Now a bridge to Signals.
 */
export function _withEffect(fn, effectFn) {
	return createEffect(() => {
		if (_isEffectDead(effectFn)) return;
		return fn();
	});
}

export function createContext(data = {}, parent = null) {
	// Map<key, Signal>
	const signals = new Map();
	const raw = {};
	
	if (_config.devtools) raw.__devtoolsId = ++_ctxId;

	function getOrCreateSignal(key, initialValue) {
		if (!signals.has(key)) {
			signals.set(key, createSignal(initialValue));
		}
		return signals.get(key);
	}

	// Initialize signals for provided data
	for (const key of Object.keys(data)) {
		getOrCreateSignal(key, data[key]);
	}

	const handler = {
		get(target, key) {
			if (key === "__isProxy") return true;
			if (key === "__raw") return target;
			if (key === "__signals") return signals;

			if (key === "$watch")
				return (keyOrFn, maybeFn) => {
					let k = "*";
					let fn = keyOrFn;

					if (typeof keyOrFn === "string" && typeof maybeFn === "function") {
						k = keyOrFn;
						fn = maybeFn;
					}

					if (_currentEl) {
						fn._elRef = new WeakRef(_currentEl);
						fn._el = _currentEl;
					}

					// Watch is now an effect that peeks or gets signals
					return createEffect(() => {
						if (_isEffectDead(fn)) return;
						if (k === "*") {
							// Global watch: touch all existing signals
							for (const s of signals.values()) s.get();
						} else {
							getOrCreateSignal(k).get();
						}
						fn();
					});
				};

			if (key === "$notify") return (k = "*") => {
				if (k === "*") {
					for (const s of signals.values()) s.set(s.peek());
				} else {
					const s = signals.get(k);
					if (s) s.set(s.peek());
				}
			};

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
						obj[lastKey] = v;
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

			if (
				typeof key === "string" &&
				key.startsWith("$") &&
				key.slice(1) in _globals
			) {
				return _globals[key.slice(1)];
			}

			if (typeof key === "string" && !key.startsWith("$")) {
				if (key in target || signals.has(key)) {
					return getOrCreateSignal(key, target[key]).get();
				}
			}

			if (parent?.__isProxy) return parent[key];
			return target[key];
		},
		set(target, key, value) {
			const old = target[key];
			target[key] = value;
			
			if (typeof key === "string" && !key.startsWith("$")) {
				getOrCreateSignal(key, value).set(value);
			}

			if (old !== value) {
				_ctxGeneration++;
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
			if (key in target || signals.has(key)) return true;
			if (typeof key === "string" && key.startsWith("$")) {
				const builtins = new Set([
					"$watch",
					"$notify",
					"$set",
					"$parent",
					"$refs",
					"$store",
					"$route",
					"$router",
					"$i18n",
					"$form",
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
