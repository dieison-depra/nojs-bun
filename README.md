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
- **Reactive Binding** — `bind`, `bind-*`, `model` for one/two-way data binding
- **Conditionals & Loops** — `if`, `else-if`, `show`, `hide`, `each`, `foreach`, `switch`
- **State Management** — `state` (local), `store` (global), `computed`, `watch`, `notify()`
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

1. **Parse** — On `DOMContentLoaded`, No.JS walks the DOM for known attributes
2. **Resolve** — Each attribute maps to a directive, executed by priority
3. **React** — Data lives in Proxy-backed reactive contexts; changes auto-update the DOM
4. **Scope** — Contexts inherit from parents, like lexical scoping
5. **Secure** — Expressions run in a sandboxed evaluator (no eval, no Function); HTML is sanitized via DOMParser

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

## Credits

Original project: **[No.JS](https://github.com/ErickXavier/no-js)** by [Erick Xavier](https://github.com/ErickXavier).
This fork exists solely to run the framework on a Bun-native environment.

## Community (upstream)

For questions, discussions, and community support, refer to the original project:

- [Discord](https://discord.gg/CaSbGYg3xY)
- [GitHub Discussions](https://github.com/ErickXavier/no-js/discussions)

## License

[MIT](LICENSE) — same as the original project.
