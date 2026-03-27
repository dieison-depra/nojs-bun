# Node.js to Bun Migration Report

This document details the complete migration of the No.JS framework from a Node.js-based environment to a 100% Bun-native ecosystem, including technical audits and stability improvements.

## 🚀 Migration Overview
The goal was to eliminate legacy Node.js dependencies, leverage Bun's high-performance APIs (build, serve, test), and stabilize the testing environment while maintaining 100% compatibility with the upstream functional logic.

---

## 📊 Summary of Changes (Executive View)

| Category | Description | Key Actions |
| :--- | :--- | :--- |
| **1. Runtime Migration** | Transition from Node.js/NPM to Bun. | Rewrote `build.js` using `Bun.build`; Converted servers to `Bun.serve`; Replaced `jest` with `bun test`. |
| **2. Logic & Bug Fixes** | Critical fixes for A11y, Memory, and Logic. | Added `tabindex="0"` to `drag`; Fixed `_disposeChildren` imports; Resolved `NoJS.notify()` duplication. |
| **3. Test Suite Adaptation** | Adjusting tests for Bun/JSDOM stability. | Created `__tests__/setup.js` bridge; Stabilized `throttle` tests; Refactored E2E animation race conditions. |

---

## 🔍 Detailed Technical Audit

### 1. Migration of Runtime (Node.js → Bun)
*   **`package.json`**:
    *   Removed Node ecosystem dependencies: `esbuild`, `jest`, `babel-jest`, `@babel/core`, and `jsdom` (as a direct dependency).
    *   Added Bun native tools: `bun-types`, `@biomejs/biome` (lint/format), and `knip` (dead code analysis).
    *   Updated all scripts to use `bun run`, `bun test`, and `bun x playwright`.
*   **`build.js`**: Completely rewritten to use the native `Bun.build` API, eliminating the `esbuild` overhead.
*   **`docs/dev-server.js` and `test-server.js`**: Converted from Node `http` module to `Bun.serve`, resulting in faster, lightweight development servers.
*   **`bunfig.toml`**: Created to manage global test timeouts and environment preloading.
*   **Cleanup**: Deleted legacy configuration files: `babel.config.js`, `jest.config.js`, and `package-lock.json`.

### 2. Bug Fixes, Logic, and Vulnerabilities
*   **Accessibility (A11y)**: Automatically added `tabindex="0"` to the `drag` directive in `src/directives/dnd.js`. Draggable elements are now keyboard-accessible (UX improvement).
*   **Import Fix (`_disposeChildren`)**: Corrected the import path in `src/directives/dnd.js`. The utility was incorrectly being imported from `dom.js` instead of `registry.js`.
*   **Code Duplication**: Removed a duplicate `notify()` method in `src/index.js` that occurred during synchronization with the upstream.
*   **E2E Example Fix**: Corrected a function name mismatch in `e2e/examples/state-binding.html` (`_toggleThemeExternal` → `toggleThemeExternal`) that prevented testing the `NoJS.notify()` feature.
*   **Security and Hygiene**:
    *   Applied **Biome** rules across `src/` to prevent implicit returns in `forEach`, ensuring DOM side-effects don't leak unexpected values.
    *   Removed the `export` keyword from internal variables in `src/i18n.js` identified as unused by `Knip`.
*   **Memory Consolidation**: Unified the use of `_disposeChildren` and `_onDispose` across all directives to ensure that no listeners or orphan elements cause memory leaks.

### 3. Test Suite Adaptation (Bun + JSDOM)
*   **`__tests__/setup.js`**: Built a compatibility bridge that injects browser APIs into Bun's global scope and patches JSDOM's `dispatchEvent` to ensure `instanceof Event` checks pass correctly.
*   **State Isolation (`core.test.js`)**: Added a manual reset of the `_config` object in `beforeAll`, preventing test pollution where configuration tests leaked values into other suites.
*   **Timer Stabilization (`directives-ui.test.js`)**: Migrated the `throttle` test from unstable clock mocks to real-time asynchronous delays, as Bun handles the event loop differently than Node.
*   **E2E Animation Resilience**: Refactored `e2e/tests/animations.e2e.ts` to use Playwright's `expect().toHaveClass()` polling. This allows the test to wait for the animation frame automatically, eliminating race conditions.
*   **Timeouts and Ticks**:
    *   Increased timeouts to 15s/60s for heavy DOM-processing tests in JSDOM.
    *   Included `await new Promise(r => setTimeout(r, 10))` in DnD tests to allow JSDOM time to process ARIA attribute updates.
*   **E2E File Renaming**: Renamed `.spec.ts` files to `.e2e.ts` to prevent `bun test` from attempting to execute integration tests as unit tests.

### 4. Performance Audit & Infinite Recursion Fix
During the transition to Bun, a critical performance bottleneck was identified in the `foreach` directive when using "inline templates" (using the element itself as a template without an external `<template>` tag).

*   **The Problem:** In JSDOM, using the element itself as a template caused an infinite recursion loop. The directive would clone the element (including its `foreach` attribute), and `processTree` would re-initialize the cloned element, leading to exponential DOM growth and high CPU usage. This caused two specific tests in `directives-ui.test.js` to take **27.1 seconds** to complete.
*   **The Fix:** Modified `src/directives/loops.js` to explicitly remove the `foreach` and `from` attributes from the cloned element before it is processed by the engine.
*   **The Result:** The fix reduced the execution time of those tests from 14s each to less than **1s** combined.

---

## 📊 Benchmark Results (Bun + JSDOM)

The following metrics represent the complete unit test suite (1046 tests) on macOS (Darwin).

| Metric | Before Fix (JSDOM) | After Fix (JSDOM + Fix) | Improvement |
| :--- | :--- | :--- | :--- |
| **Build Time** | 0.05s | 0.05s | - |
| **Total Test Time (Real)** | 37.09s | **9.67s** | **-73.9%** |
| **CPU Time (User)** | 32.03s | **3.74s** | **-88.3%** |
| **Peak Memory (RSS)** | 435.97 MB | **210.94 MB** | **-51.6%** |

*Note: The project now outperforms the legacy Node.js/Jest implementation (14.07s) by over 30% in real-world execution speed.*

---

## ✅ Final Status (v1.11.0 — 2026-03-26)
- **Runtime:** 100% Bun Native
- **Upstream parity:** v1.11.0 (ErickXavier/no-js `6fbde9f`)
- **Build Speed:** < 0.1s
- **Test Speed:** < 10s (Unit) / < 30s (E2E)
- **E2E Success (Playwright):** 100% (26/26 tests — infraWebDev)
- **Unit Test Success (Bun):** 1370 tests, 3 pre-existing failures (router popstate, anchor link, validation reset — unrelated to migration)
- **Vulnerabilities:** 0 (Audit clean)

---

## v1.11.0 Upstream Sync (2026-03-26)

After the initial Bun migration, the following features from upstream v1.11.0 were ported:

| Feature | Files |
|---------|-------|
| Head management directives (`page-title`, `page-description`, `page-canonical`, `page-jsonld`) | `src/directives/head.js` (new), `src/index.js` |
| Router `_applyRouteHeadAttrs()` — SEO meta from route templates | `src/router.js` |
| Router `focusBehavior` — a11y focus management on navigation | `src/globals.js`, `src/router.js` |
| Router `suppressHashWarning` — silence hash-mode warning | `src/globals.js`, `src/router.js` |
| Memory leak regression test suite (T1–T6) | `__tests__/leak-regression.test.js` |
| API audit test suite | `__tests__/audit-changes.test.js` |
| Head directives test suite | `__tests__/directives-head.test.js`, `__tests__/inject-head-attrs.test.js` |
| Keyed reconciliation benchmark | `__benchmarks__/keyed-vs-rebuild.bench.spec.ts` |

See `sync-map-with-nojs.md` for full traceability and instructions for future syncs.
