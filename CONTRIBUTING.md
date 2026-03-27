# Contributing

This is a personal fork of [ErickXavier/no-js](https://github.com/ErickXavier/no-js) migrated to run 100% natively on [Bun](https://bun.sh). It is not a community-driven project and does not actively solicit external contributions.

If you find a bug or want to suggest something, feel free to open an issue — but there are no guarantees of response or merge timelines.

---

## Development Setup

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.0

```bash
git clone https://github.com/dieison-depra/nojs-bun.git
cd nojs-bun
bun install

# Build (outputs to dist/)
bun run build

# Run unit tests
bun test

# Run E2E tests (requires Playwright browsers)
bun x playwright install   # first time only
bun run test:e2e

# Run all tests
bun run test:all
```

---

## Project Structure

```
src/
├── index.js              # Public API
├── globals.js            # Shared state (_config, _stores, _eventBus…)
├── context.js            # Reactive proxy contexts
├── evaluate.js           # Expression evaluator
├── registry.js           # registerDirective(), processTree()
├── dom.js                # DOM helpers and HTML sanitization
├── router.js             # SPA router
├── i18n.js               # Internationalization
├── filters.js            # Built-in filters
├── animations.js         # Transitions and stagger
├── fetch.js              # Declarative HTTP
├── devtools.js           # DevTools bridge
└── directives/           # One file per directive category
    ├── head.js            # page-title, page-description, page-canonical, page-jsonld
    ├── state.js
    ├── binding.js
    ├── conditionals.js
    ├── loops.js
    ├── http.js
    ├── events.js
    ├── styling.js
    ├── refs.js
    ├── validation.js
    ├── i18n.js
    └── dnd.js

__tests__/                # bun:test unit tests (jsdom / happy-dom)
e2e/tests/                # Playwright E2E tests
__benchmarks__/           # Performance benchmarks
```

---

## Code Conventions

| Convention | Detail |
|-----------|--------|
| Formatter | Biome — tabs, double quotes |
| Private API | `_` prefix (`_config`, `_log()`) |
| Public API | Exported on `NoJS` object |
| Logging | `_log()` / `_warn()` — never `console.log` directly |
| Global state | Always in `globals.js` |
| No eval | Expressions run in sandboxed evaluator — never use `eval()` or `Function()` |

---

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: short description
fix: short description
docs: short description
test: short description
chore: short description
refactor: short description
```

---

## Syncing with Upstream

See [sync-map-with-nojs.md](sync-map-with-nojs.md) for git SHA traceability and instructions on how to evaluate and port new features from the upstream project.
