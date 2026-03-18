# No.JS Project Memory

## Project Overview
No.JS is an HTML-first reactive framework designed to build dynamic web applications using only HTML attributes. It is a 100% Bun-native project following a recent migration from Node.js.

## Technical Environment (Current State)
- **Runtime:** Bun 1.x (Native)
- **Build System:** `build.js` using `Bun.build` (outputs IIFE, ESM, CJS).
- **Quality/Linting:** Biome (applied to `src` and `e2e`, strict rules for core, relaxed for tests).
- **Test Runner:** `bun test` with `JSDOM` environment (configured via `bunfig.toml` and `__tests__/setup.js`).
- **E2E Testing:** Playwright (configured for Bun).
- **Security:** `bun audit` (0 vulnerabilities).
- **Code Coverage:** ~95% line coverage.

## Core Decisions & Migrations
1. **Node.js → Bun Migration:** Removed Node dependencies (`esbuild`, `jest`, `babel`, `jsdom` as external). Replaced with Bun natives.
2. **Resource Disposal:** Implemented `_disposeChildren(el)` and `_onDispose(fn)` to prevent memory leaks during reactive re-renders. This is centralized in `src/registry.js`.
3. **Event System Compatibility:** Patched `window.EventTarget.prototype.dispatchEvent` in tests to ensure `instanceof Event` checks pass within JSDOM/Bun.
4. **Clean Code:** Use of `Biome` for formatting and linting. Dead code identified by `Knip` has been partially removed (unused exports and devDeps).

## Key Files
- `src/index.js`: Public API and initialization.
- `src/registry.js`: Directive registration and DOM processing.
- `src/globals.js`: Configuration, event bus, and shared state.
- `src/directives/`: Modular implementation of all HTML superpowers.
- `__tests__/setup.js`: Crucial for reproducing the test environment.
