<h1>
  <img src="docs/logo-dark-round.png" alt="No.JS" width="26" style="vertical-align: middle; margin-top: -6px;"> No.JS — Bun Fork
</h1>

> **This is a personal fork** of [ErickXavier/no-js](https://github.com/ErickXavier/no-js), migrated to run 100% natively on the [Bun](https://bun.sh) runtime.
> It introduces its own additions and divergences. It may eventually incorporate new features from the upstream project, but that is not guaranteed or a stated goal.
> For the original project, documentation, CDN, and community, see the upstream repo: **[ErickXavier/no-js](https://github.com/ErickXavier/no-js)**.

---

**The HTML-First Reactive Framework — Bun Native**

Build dynamic, reactive web applications using nothing but HTML attributes.
No build step. No virtual DOM. No transpiler. No JSX. Just HTML.

```html
<div get="/users/1" as="user">
  <h1 bind="user.name">Loading...</h1>
  <p bind="user.email"></p>
</div>
```

**Zero JavaScript written. Fully reactive. Real API data.**

---

## Features

- **Declarative HTTP** — `get`, `post`, `put`, `patch`, `delete` as HTML attributes
- **Reactive Binding** — `bind`, `bind-*`, `model` with granular dirty-checking
- **Conditionals & Loops** — `if`, `else-if`, `show`, `hide`, `each`, `foreach`, `switch` (with `virtual` support)
- **State Management** — `state` (local), `store` (global), `computed`, `watch`, `notify()`
- **Hybrid Engine** — Native Rust/Wasm core for expression evaluation and diffing
- **SPA Routing** — `route`, `route-view`, guards, params, nested routes, wildcard catch-all
- **Forms & Validation** — Built-in + custom validators, per-rule errors, async support, `$form` context
- **Plugin System** — Extend with reusable packages: interceptors, globals, directives, lifecycle hooks
- **Animations** — `animate`, `transition` with stagger support
- **i18n** — `t` directive with pluralization, namespaces, browser detection
- **Filters** — `uppercase`, `currency`, `date`, `truncate`, 32 built-in pipes
- **Drag & Drop** — `drag`, `drop`, `drag-list`, multi-select, keyboard DnD
- **DevTools** — Built-in inspector with context mutation, store inspection, element highlighting
- **Security** — DOMParser-based sanitization, CSP-safe (no eval/Function), header redaction, prototype pollution protection
- **Custom Directives** — Extend with `NoJS.directive()`
- **Static Hoisting** — `data-nojs-static` skips known-static islands entirely during DOM walk
- **TypeScript Support** — Type definitions for plugin authors (`types/nojs-plugin.d.ts`)

---

## Quick Start

### Local / Self-hosted

Build from source and include the output file:

```bash
git clone https://github.com/dieison-depra/nojs-bun.git
cd nojs-bun
bun install
bun run build
# Output: dist/iife/no.js
```

```html
<script src="/path/to/no.js"></script>
```

### CDN (upstream — original project)

The upstream project is available via CDN. This fork is **not published** to any CDN or npm registry:

```html
<!-- upstream only -->
<script src="https://cdn.no-js.dev/"></script>
```

---

## Example

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.no-js.dev/"></script>
</head>
<body base="https://jsonplaceholder.typicode.com">

  <!-- Fetch & display data -->
  <div get="/users" as="users" loading="#skeleton">
    <div each="user in users">
      <h2 bind="user.name"></h2>
      <p bind="user.email"></p>
    </div>
  </div>

  <!-- Local state + events -->
  <div state="{ count: 0 }">
    <button on:click="count++">Clicked <span bind="count"></span> times</button>
  </div>

  <!-- Form with validation -->
  <form post="/posts" validate success="#ok">
    <input name="title" required minlength="3" />
    <button type="submit" bind-disabled="!$form.valid">Submit</button>
  </form>

  <template id="skeleton"><p>Loading...</p></template>
  <template id="ok" var="res"><p>Created: <span bind="res.title"></span></p></template>

</body>
</html>
```

No `app.mount()`. No `createApp()`. No `NgModule`. It just works.

---

## Plugin System

Extend No.JS with reusable packages — analytics, auth, feature flags, UI libraries — without modifying the core.

```html
<script>
  NoJS.use({
    name: 'analytics',
    version: '1.0.0',
    capabilities: ['interceptors', 'globals'],

    install(app, options) {
      app.global('analytics', { pageViews: 0 });
      app.interceptor('response', (response, url) => {
        console.log('API call:', url, response.status);
        return response;
      });
    },

    init(app) {
      console.log('Analytics ready');
    },

    dispose(app) {
      console.log('Analytics cleaned up');
    }
  });
</script>
```

Plugins have access to the full API: `directive()`, `filter()`, `validator()`, `interceptor()`, `global()`, `on()`, and more.

---

## Performance Architecture

This fork ships nine runtime optimizations across five phases targeting CPU, memory, and DOM-walk cost. All optimizations are implemented and active.

#### Phase Optimizations (v1.12.0)

| Phase | Optimization | Benefit |
|-------|-------------|---------|
| **1 — Fine-Grained Reactivity** | Key-based subscriptions (`Map<Key, Set<Fn>>`) replace a single per-context broadcast set | Only directives bound to the changed key are re-evaluated — 40–60% CPU reduction on multi-binding components |
| **2 — JIT Expression Compiler** | Cached AST nodes are compiled into native JS functions via the recursive-descent compiler | Near-native expression execution — ~10× faster than walking the AST on every evaluation |
| **3 — Global Event Manager** | Single `document.body` listener dispatches `click`/`input`/`change` to directives via `closest()` | Significant memory savings on large lists — one listener replaces N per-element listeners |
| **4 — Template Cloning Engine** | Loop reconciliation skips `$index`/`$first`/`$last` metadata updates for items whose position did not change | Faster "swap rows" and "remove item" operations in benchmark scenarios |
| **5 — Static Hoisting Skipper** | Elements marked `data-nojs-static` (and their entire subtrees) are skipped by `processTree` | Zero-cost DOM walks over server-rendered or pre-built islands |

#### Additional Optimizations (v1.13.0)

| ID | Optimization | Benefit |
|----|-------------|---------|
| **R2 — DocumentFragment batch insert** | All loop render paths collect new wrappers in a `DocumentFragment` and insert via a single `el.appendChild(frag)` | Reduces layout/style recalculation passes — P1 benchmark -10%, P7 -20% |
| **R9 — Effect deduplication** | `_notifyRunSet` prevents a catch-all (`*`) watcher from running more than once in the same synchronous `notify()` pass | Eliminates redundant effect executions when multiple keys change in a single event handler |
| **R10 — WeakRef element tracking** | `$watch` stores effect bindings as `WeakRef(el)`; `_isEffectDead()` centralises dead-element detection in `notify()` and `_endBatch()` | DOM nodes removed and no longer referenced are eligible for GC even while effects remain in listener Sets — reduces long-term heap pressure in SPAs |
| **R15 — `_disposeAndClear` batch dispose** | New `_disposeAndClear(parent)` moves children to an off-DOM `DocumentFragment` before running disposers | Disposer callbacks fire off the live document — zero browser layout recalcs during list teardown |

### Using Static Hoisting

```html
<!-- This subtree is never walked by No.JS — ideal for SSR output or pre-built components -->
<section data-nojs-static>
  <h2>Server-Rendered Content</h2>
  <p>No directives here — No.JS will skip this entire block.</p>
</section>

<!-- This element is processed normally -->
<div state="{ count: 0 }">
  <button on:click="count++">Clicks: <span bind="count"></span></button>
</div>
```

---

## Documentation

Full documentation is available in the [docs/](docs/) folder:

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/md/getting-started.md) | Installation, core concepts, how it works |
| [Data Fetching](docs/md/data-fetching.md) | `get`, `post`, `put`, `patch`, `delete`, caching, polling |
| [Data Binding](docs/md/data-binding.md) | `bind`, `bind-html`, `bind-*`, `model` |
| [Conditionals](docs/md/conditionals.md) | `if`, `else-if`, `show`, `hide`, `switch`/`case` |
| [Loops](docs/md/loops.md) | `each`, `foreach`, loop variables, nested loops |
| [Templates](docs/md/templates.md) | Reusable fragments, slots, remote templates |
| [State Management](docs/md/state-management.md) | `state`, `store`, `into`, `computed`, `watch` |
| [Events](docs/md/events.md) | `on:*`, modifiers, lifecycle hooks |
| [Dynamic Styling](docs/md/styling.md) | `class-*`, `style-*` |
| [Forms & Validation](docs/md/forms-validation.md) | `validate`, `$form`, custom validators |
| [Routing](docs/md/routing.md) | SPA navigation, guards, nested routes |
| [Animations](docs/md/animations.md) | `animate`, `transition`, stagger |
| [i18n](docs/md/i18n.md) | Translations, pluralization, formatting |
| [Filters](docs/md/filters.md) | Built-in filters, chaining, custom filters |
| [Actions & Refs](docs/md/actions-refs.md) | `call`, `trigger`, `ref`, `$refs` |
| [Plugins](docs/md/plugins.md) | Plugin API, interceptors, globals, lifecycle |
| [Custom Directives](docs/md/custom-directives.md) | Extend No.JS |
| [Error Handling](docs/md/error-handling.md) | Error boundaries, global handler |
| [Configuration](docs/md/configuration.md) | Global settings, interceptors, template caching, security |
| [Cheatsheet](docs/md/cheatsheet.md) | Every directive at a glance |
| [Full SPA Example](docs/md/examples.md) | Complete app with routing, auth, i18n |

---

## How It Works

1. **Parse** — On `DOMContentLoaded`, No.JS walks the DOM for known attributes; `data-nojs-static` subtrees are skipped entirely
2. **Resolve** — Each attribute maps to a directive, executed by priority
3. **React** — Data lives in Proxy-backed reactive contexts with key-level subscriptions; only bound directives re-run on change; duplicate effect executions within the same synchronous pass are deduplicated
4. **Evaluate** — Expressions are compiled once into native JS functions by the JIT compiler and cached for subsequent calls
5. **Scope** — Contexts inherit from parents, like lexical scoping; `$store`, `$route`, `$refs` and other special variables are visible anywhere in the chain
6. **Dispose** — When list items or components are removed, `_disposeAndClear` detaches the subtree off-DOM before running disposers; effect callbacks holding `WeakRef(el)` become GC-eligible once the element has no other references
7. **Secure** — Expressions run in a sandboxed evaluator (no eval, no Function); HTML is sanitized via DOMParser

---

## Ecosystem

| Tool | Description |
|------|-------------|
| [NoJS-LSP](https://github.com/ErickXavier/nojs-lsp) | VS Code extension — autocomplete, hover docs, diagnostics for No.JS HTML |
| [NoJS-MCP](https://github.com/ErickXavier/nojs-mcp) | MCP server — AI tools for building No.JS apps |

---

## Differences from Upstream

| Area | This fork (Bun) | Upstream (ErickXavier/no-js) |
|------|----------------|------------------------------|
| Runtime | Bun (100% native) | Node.js |
| Build | `Bun.build` | esbuild |
| Test runner | `bun test` | Jest |
| Linter/formatter | Biome | ESLint / Prettier |
| Dev server | `Bun.serve` | Node `http` |
| Dead code | knip | — |
| Test env | happy-dom + jsdom | jsdom |
| Module format | ESM (`"type": "module"`) | CJS + ESM |
| Reactivity | Fine-grained (key-level) | Coarse-grained (context-level) |
| Expressions | JIT-compiled functions | AST walk per evaluation |
| Static islands | `data-nojs-static` skip | Full tree walk |
| Loop inserts | `DocumentFragment` batched | N individual DOM appends |
| List teardown | `_disposeAndClear` (off-DOM) | `_disposeChildren` + `innerHTML=""` |
| Memory (effects) | `WeakRef` element tracking | Strong `_el` reference only |

## Credits

Original project: **[No.JS](https://github.com/ErickXavier/no-js)** by [Erick Xavier](https://github.com/ErickXavier).
This fork exists to run the framework on a Bun-native environment and to explore runtime performance improvements not present in the upstream.

## Community (upstream)

For questions, discussions, and community support, refer to the original project:

- [Discord](https://discord.gg/CaSbGYg3xY)
- [GitHub Discussions](https://github.com/ErickXavier/no-js/discussions)

## License

[MIT](LICENSE) — same as the original project.
