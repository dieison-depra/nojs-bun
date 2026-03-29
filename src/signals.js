/**
 * No.JS Signal System — Fine-grained reactivity
 */

let activeEffect = null;
const effectStack = [];
const pendingEffects = new Set();
let isBatching = false;

/**
 * Creates a Signal (reactive atom)
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
			
			// Schedule effects for next microtask
			for (const effect of subscribers) {
				pendingEffects.add(effect);
			}
			scheduleUpdate();
		},
		peek() {
			return value;
		}
	};
}

function scheduleUpdate() {
	if (isBatching) return;
	isBatching = true;
	queueMicrotask(flushEffects);
}

function flushEffects() {
	isBatching = false;
	const effects = Array.from(pendingEffects);
	pendingEffects.clear();
	
	// Topological sort would happen here. For now, simple deduplicated run.
	for (const effect of effects) {
		effect.run();
	}
}

/**
 * Creates an Effect (auto-running reactive scope)
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
		}
	};

	effect.run();
	return () => cleanup(effect);
}

/**
 * Legacy bridge for internal framework use
 */
export function _withEffect(fn) {
	return createEffect(fn);
}

/**
 * Creates a Memo (cached derived value)
 */
export function createMemo(fn) {
	let cachedValue;
	let dirty = true;
	const signal = createSignal(null);

	const effect = createEffect(() => {
		dirty = true;
		signal.set(Math.random()); // Trigger downstream
	});

	return {
		get() {
			if (dirty) {
				cachedValue = fn();
				dirty = false;
			}
			return cachedValue;
		}
	};
}

function cleanup(effect) {
	for (const dep of effect.dependencies) {
		dep.delete(effect);
	}
	effect.dependencies.clear();
}
