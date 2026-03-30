/**
 * No.JS Signal System — Fine-grained reactivity (R1 + R9)
 *
 * Scheduling: effects run asynchronously via queueMicrotask (R9).
 * Testing: use flushSync() to drain the pending-effects queue synchronously.
 * Batching: _startSignalBatch()/_endSignalBatch() defer all effects until the
 * outer batch ends, then flush synchronously (used by _startBatch/_endBatch in
 * context.js so that multi-key writes fire each watcher exactly once).
 */

let activeEffect = null;
const effectStack = [];
const pendingEffects = new Set();
let isBatching = false;
let _batchDepth = 0; // external batch depth (context._startBatch / _endBatch)

// ─── Signal ──────────────────────────────────────────────────────────────────

/**
 * Creates a reactive Signal atom.
 * @param {*} initialValue
 * @returns {{ get(): *, set(v: *): void, notify(): void, peek(): * }}
 */
export function createSignal(initialValue) {
	let value = initialValue;
	const subscribers = new Set();

	return {
		get() {
			if (activeEffect) {
				subscribers.add(activeEffect);
				activeEffect.dependencies.add(subscribers);
			}
			return value;
		},
		set(newValue) {
			if (value === newValue) return;
			value = newValue;
			for (const effect of subscribers) {
				pendingEffects.add(effect);
			}
			scheduleUpdate();
		},
		/** Force-notify all subscribers even if the value has not changed. */
		notify() {
			for (const effect of subscribers) {
				pendingEffects.add(effect);
			}
			scheduleUpdate();
		},
		peek() {
			return value;
		},
	};
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

function scheduleUpdate() {
	if (_batchDepth > 0) return; // in explicit batch — accumulate, don't run yet
	if (isBatching) return;
	isBatching = true;
	queueMicrotask(flushEffects);
}

function flushEffects() {
	isBatching = false;
	// Use a while loop to handle cascading effects produced during a flush.
	while (pendingEffects.size > 0) {
		const effects = Array.from(pendingEffects);
		pendingEffects.clear();
		for (const effect of effects) {
			effect.run();
		}
	}
}

/**
 * Flush all pending effects synchronously.
 * Intended for use in tests and at the end of explicit batches.
 */
export function flushSync() {
	// Reset isBatching so cascading sets inside the flush can reschedule safely.
	isBatching = false;
	while (pendingEffects.size > 0) {
		const effects = Array.from(pendingEffects);
		pendingEffects.clear();
		for (const effect of effects) {
			effect.run();
		}
	}
}

// ─── Batch control (used by context._startBatch / _endBatch) ─────────────────

/**
 * Begin an explicit batch.  While depth > 0, signal mutations accumulate
 * without scheduling a microtask.
 */
export function _startSignalBatch() {
	_batchDepth++;
	isBatching = true; // suppress queueMicrotask inside the batch
}

/**
 * End an explicit batch.  When the outermost batch closes, pending effects are
 * flushed synchronously so callers can assert results immediately.
 */
export function _endSignalBatch() {
	_batchDepth--;
	if (_batchDepth === 0) {
		isBatching = false;
		flushSync();
	}
}

// ─── Effect ──────────────────────────────────────────────────────────────────

/**
 * Creates an auto-tracking Effect that re-runs whenever its signal dependencies
 * change.  Runs once immediately on creation to establish dependencies.
 *
 * @param {() => void} fn
 * @returns {() => void} cleanup / unsubscribe function
 */
export function createEffect(fn) {
	const effect = {
		dependencies: new Set(),
		run() {
			cleanup(effect);
			effectStack.push(activeEffect);
			activeEffect = effect;
			try {
				fn();
			} finally {
				activeEffect = effectStack.pop();
			}
		},
	};

	effect.run(); // initial run to subscribe
	return () => cleanup(effect);
}

/**
 * Legacy bridge — wraps fn in a createEffect, optionally checking whether
 * effectFn (a directive update function with ._el / ._elRef) is still alive.
 *
 * @param {() => void} fn        - function to run reactively
 * @param {Function}   [effectFn] - optional object carrying ._el / ._elRef for
 *                                  dead-element detection
 * @returns {() => void} cleanup function
 */
export function _withEffect(fn, effectFn) {
	return createEffect(() => {
		if (effectFn) {
			if (effectFn._elRef) {
				const el = effectFn._elRef.deref();
				if (!el || !el.isConnected) return;
			} else if (effectFn._el && !effectFn._el.isConnected) {
				return;
			}
		}
		fn();
	});
}

// ─── Memo ────────────────────────────────────────────────────────────────────

/**
 * Creates a Memo — a cached derived value that recomputes whenever its
 * reactive dependencies change.
 *
 * @param {() => *} fn - pure computation (may read signals/memos)
 * @returns {{ get(): *, peek(): * }}
 */
export function createMemo(fn) {
	// The memo's current value is stored in a signal so that downstream
	// effects that call memo.get() subscribe reactively and re-run whenever
	// the memo recomputes.
	const signal = createSignal(undefined);

	// This effect re-runs whenever fn's dependencies change, updating the
	// signal (and therefore notifying downstream effects) only when the
	// computed value actually changes.
	createEffect(() => {
		const newValue = fn();
		signal.set(newValue);
	});

	return {
		/** Reactive read — subscribes the current active effect. */
		get() {
			return signal.get();
		},
		/** Non-reactive peek — does not subscribe. */
		peek() {
			return signal.peek();
		},
	};
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function cleanup(effect) {
	for (const dep of effect.dependencies) {
		dep.delete(effect);
	}
	effect.dependencies.clear();
}
