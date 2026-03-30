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
import {
	createEffect,
	createSignal,
	flushSync,
	_startSignalBatch,
	_endSignalBatch,
} from "./signals.js";

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
	_startSignalBatch();
	_devtoolsEmit("batch:start", { depth: _batchDepth });
}

export function _endBatch() {
	_batchDepth--;
	if (_batchDepth === 0) {
		_devtoolsEmit("batch:end", { depth: 0, queueSize: _batchQueue.size });
		if (_batchQueue.size > 0) {
			const fns = [..._batchQueue];
			_batchQueue.clear();
			fns.forEach((fn) => {
				if (_isEffectDead(fn)) return;
				fn();
			});
		}
	}
	_endSignalBatch(); // flushes synchronously when depth reaches 0
}

/**
 * Execute a function and track which reactive keys it accesses.
 * Bridge to the Signal system — kept for backward-compat with directives.
 * @deprecated Use createEffect directly where possible.
 */
export function _withEffect(fn, effectFn) {
	return createEffect(() => {
		if (effectFn && _isEffectDead(effectFn)) return;
		fn();
	});
}

export function createContext(data = {}, parent = null) {
	// Map<key, Signal>
	const signals = new Map();
	// Backward-compat listener map for registry.js disposal (Map<key, Set<fn>>).
	// The signal system handles reactivity; this map only tracks raw watcher fns
	// so _disposeElement can clean up _storeWatchers / _i18nListeners entries.
	const listenerMap = new Map([["*", new Set()]]);
	// raw is the proxy target; initial data is written here so that __raw.x
	// returns the initial value and _collectKeys can read from it.
	const raw = {};

	// Write initial data both to raw and to the signals map.
	for (const key of Object.keys(data)) {
		raw[key] = data[key];
	}

	if (_config.devtools) raw.__devtoolsId = ++_ctxId;

	function getOrCreateSignal(key, initialValue) {
		if (!signals.has(key)) {
			signals.set(key, createSignal(initialValue));
		}
		return signals.get(key);
	}

	// Initialize signals for provided data (raw already populated above).
	for (const key of Object.keys(data)) {
		getOrCreateSignal(key, data[key]);
	}

	// Pre-create the notify counter so $watch() always subscribes to it,
	// even on contexts that start empty.  This ensures ctx.$notify() always
	// reaches global watchers regardless of when they registered.
	getOrCreateSignal("$__notify__", 0);

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

					// Track fn in the backward-compat listenerMap for registry disposal.
					if (!listenerMap.has(k)) listenerMap.set(k, new Set());
					listenerMap.get(k).add(fn);

					// Skip the initial subscription run — the watcher should only fire
					// when the value *changes*, matching the legacy context contract.
					let initialized = false;
					const cleanupEffect = createEffect(() => {
						if (_isEffectDead(fn)) return;
						if (k === "*") {
							// Global watch: subscribe to every existing signal (including
							// the $__notify__ counter so explicit $notify() triggers this).
							for (const s of signals.values()) s.get();
						} else {
							getOrCreateSignal(k).get();
						}
						if (initialized) fn();
						initialized = true;
					});
					return () => {
						cleanupEffect();
						listenerMap.get(k)?.delete(fn);
					};
				};

			// $notify() — force-triggers all watchers even when the value hasn't
			// changed (e.g. after in-place object mutation).
			if (key === "$notify")
				return (k = "*") => {
					if (k === "*") {
						// Increment the dedicated notify-counter signal so that global
						// $watch effects (which subscribe to it) are always re-run.
						const ns = getOrCreateSignal("$__notify__", 0);
						ns.set(ns.peek() + 1);
						// Also force-notify every other signal.
						for (const [sk, s] of signals) {
							if (sk !== "$__notify__") s.notify();
						}
					} else {
						const s = signals.get(k);
						if (s) s.notify();
					}
					// Flush synchronously so callers can assert results immediately
					// (mirrors legacy $notify() contract).
					flushSync();
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
						const topSignal = signals.get(parts[0]);
						if (topSignal) topSignal.notify();
					}
				};

			if (key === "$parent") return parent;
			if (key === "__listeners") return listenerMap; // backward-compat alias
			if (key === "$refs") return target.$refs ?? _refs;
			if (key === "$store") return _stores;
			if (key === "$route")
				return _routerInstance ? _routerInstance.current : {};
			if (key === "$router") return _routerInstance;
			if (key === "$i18n") return _i18n;
			// $form goes through getOrCreateSignal so that bind effects subscribe
			// and automatically re-run when the form validation directive updates it.
			if (key === "$form")
				return getOrCreateSignal("$form", target.$form ?? null).get();

			if (
				typeof key === "string" &&
				key.startsWith("$") &&
				key.slice(1) in _globals
			) {
				return _globals[key.slice(1)];
			}

			if (typeof key === "string" && !key.startsWith("$")) {
				if (signals.has(key)) {
					return signals.get(key).get();
				}
				// Accessor properties (e.g. computed directives using Object.defineProperty)
				// must bypass the signal system so they delegate to their own memo.
				const desc = Object.getOwnPropertyDescriptor(target, key);
				if (desc?.get) {
					return desc.get.call(target);
				}
				if (key in target) {
					return getOrCreateSignal(key, target[key]).get();
				}
			}

			// Local raw wins over parent for $-prefixed loop variables ($index, $count, etc.)
			if (key in target) return target[key];
			if (parent?.__isProxy) return parent[key];
			return target[key];
		},
		set(target, key, value) {
			// If the key doesn't exist locally (raw or signals) but exists in the
			// parent chain, delegate the write upward. This allows expressions like
			// `tasks = tasks.filter(...)` evaluated in an item context to correctly
			// update the parent context's `tasks` signal.
			if (
				typeof key === "string" &&
				!key.startsWith("$") &&
				!(key in target) &&
				!signals.has(key) &&
				parent?.__isProxy &&
				key in parent
			) {
				parent[key] = value;
				return true;
			}

			const old = target[key];
			target[key] = value; // keep raw in sync so _collectKeys reads correctly

			if (typeof key === "string" && !key.startsWith("$")) {
				getOrCreateSignal(key, value).set(value);
			} else if (typeof key === "string" && signals.has(key)) {
				// $-prefixed keys that are tracked as signals (e.g. $form) — update them.
				signals.get(key).set(value);
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

// Collect all keys from a context + its parent chain.
// Reads from raw (kept in sync by the proxy setter) for performance; also
// checks the signals map so that keys added after construction are included.
export function _collectKeys(ctx) {
	const cache = ctx.__raw.__collectKeysCache;
	if (cache && cache.gen === _ctxGeneration) return cache.result;

	const allKeys = new Set();
	const allVals = {};
	let c = ctx;
	while (c?.__isProxy) {
		const raw = c.__raw;
		const sigs = c.__signals;

		// Signals are the canonical source of truth for data keys.
		for (const [k, signal] of sigs) {
			if (k.startsWith("$") || k === "__collectKeysCache") continue;
			if (!allKeys.has(k)) {
				allKeys.add(k);
				allVals[k] = signal.peek();
			}
		}

		// Also pick up any raw-only keys (e.g. values set directly on the
		// proxy target outside of the reactive system).
		for (const k of Object.keys(raw)) {
			if (k.startsWith("_") || k.startsWith("$") || k === "__collectKeysCache")
				continue;
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
