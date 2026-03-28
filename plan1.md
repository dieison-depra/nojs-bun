# plan1.md — nojs-bun Integrity Audit & Fix Plan

## 1. Scope

Audit of five "completed" phases and four "in-progress" adjustments from the previous work cycle.
Baseline test run: **1370 pass, 9 fail** (reported at session start).
Current test run after context compaction: **318 pass, 2 fail** (subset of files).
Full suite re-run in progress; this document covers all identified issues.

---

## 2. Completed Phases — Verification Results

| Phase | File(s) | Verdict | Evidence |
|---|---|---|---|
| Fine-Grained Reactivity | `src/context.js` | ✅ Confirmed | Proxy `set` trap calls `notify(key)` per-key; `_withEffect` / `_activeEffect` tracks dependencies automatically |
| JIT Compiler | `src/evaluate.js` | ✅ Confirmed | `evaluate()` lines 862–868: `new Function("scope","globals", \`return ${code};\`)` with LRU cache |
| Event Delegation | `src/directives/events.js` | ✅ Confirmed | `DELEGATED_EVENTS` Set + `data-nojs-event` attribute check skips per-element `addEventListener` |
| Template Cloning | `src/directives/loops.js` | ✅ Confirmed | `reconcileItems()` / `rebuildItems()` use `tpl.content.cloneNode(true)` |
| Static Skipper | `src/registry.js` | ✅ Confirmed | `processTree()` checks `data-nojs-static` and advances TreeWalker past the subtree |

All five phases are genuinely implemented in source code.

---

## 3. In-Progress Adjustments — Diagnostic Results

### A. evaluate.js issues

#### A3 — Proxy receiver bug (extraVars → ctx.__raw)

**Root cause:** `_getScope(ctx)` returns `Object.create(proxy)` — a plain object whose prototype is the Proxy. When `Object.assign(scope, extraVars)` writes keys onto `scope`, those become *own* properties on the plain object wrapper, so `scope.key = value` never hits the Proxy `set` trap. This is actually *correct* for the `extraVars` path and was the original design.

On re-inspection the set-trap receiver issue is a separate theoretical concern that does not cause the observed test failures. The two remaining failures are **B1** and **C1** below.

#### A4 — $refs in JIT

**Status:** Already fixed. `_getScope()` line 848: `scope.$refs = ctx?.$refs || _refs || {}` — this reads `$refs` from the context proxy (which may fall through to `target.$refs`) and assigns it as an own property on `scope`, so JIT code sees `$refs` correctly.

#### A5 — loop variable write-back

**Status:** Implemented in `_assignToTarget()` lines 903–929. When an Identifier exists in `ctx` (checked via `target.name in ctx`), it calls `ctx.$set(name, value)`. For loops, the parent context owns the array; `$set` is called on the immediate `ctx` which has `in` traversal to parent. The `in` operator on a Proxy walks the `has` trap which checks `$parent` — so the lookup reaches the owning context. However `ctx.$set()` only writes to the immediate proxy's raw object, not the parent that actually owns the key.

**Fix required:** `_assignToTarget` must walk the parent chain to find the context that *owns* the key before calling `$set`.

#### A1 / A2 — _warn on evaluate errors

**Status:** Both `evaluate()` (line 878) and `_execStatement()` (line 986) already call `_warn()` on exceptions. No test failures attributed to this — confirmed not a regression.

---

### B. registry.js issues

#### B1 — DevTools listener cleanup after Map change (ACTIVE FAILURE)

**File:** `src/registry.js` line 120
**Test:** `__tests__/registry.test.js` — "clears context __listeners and removes from _storeWatchers"
**Failure:**
```
TypeError: undefined is not an object (evaluating 'listeners.get("*").has')
```

**Root cause:** `_disposeElement()` calls `node.__ctx.__listeners.clear()` which removes ALL Map entries, including the `"*"` key. The test then calls `ctx.__listeners.get("*")` which returns `undefined`, and `.has(fn)` throws.

**Fix:** After clearing all per-key listener entries, re-initialize the `"*"` key with an empty Set so the Map contract is preserved.

---

### C. directives-data.test.js issues

#### C1 — $form.reset() spy (ACTIVE FAILURE)

**File:** `__tests__/directives-data.test.js`
**Test:** "Validation — \$form.reset() resets form and rechecks validity > calling \$form.reset() triggers el.reset() and re-validates"
**Failure:** `jest.spyOn` on `HTMLFormElement.reset` fails or the spy is not called because happy-dom implements `reset` as a non-configurable own property, or the directive captures the original `el.reset` reference before the spy is installed.

**Fix:** Patch `el.reset` directly as a jest mock before the test sets up the directive, and restore it in `afterEach`.

---

## 4. Fix Execution Plan

| ID | File | Change | Priority |
|---|---|---|---|
| B1 | `src/registry.js` | After `__listeners.clear()`, set `__listeners.set("*", new Set())` | 1 — active test failure |
| C1 | `__tests__/directives-data.test.js` | Replace `jest.spyOn` with direct mock on `el.reset` | 2 — active test failure |
| A5 | `src/evaluate.js` | `_assignToTarget`: walk `ctx.$parent` chain to find key owner | 3 — correctness |

---

## 5. Validation Protocol

After each fix:
```bash
bun test __tests__/registry.test.js         # B1
bun test __tests__/directives-data.test.js  # C1
bun test __tests__/directives-core.test.js  # A5 (loop write-back)
bun test                                    # full suite — target: 0 fail
```
