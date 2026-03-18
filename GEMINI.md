# Engineering Standards & Mandates

## Project Philosophy
No.JS is built on the "HTML-first" principle. The core logic must reside in HTML attributes, and the JavaScript core must be a lean, high-performance engine that enables these attributes.

## Technical Mandates
1. **Bun Native:** Use Bun native APIs (`Bun.serve`, `Bun.build`, `Bun.file`, `bun test`) whenever possible. Do NOT introduce Node-specific dependencies.
2. **Memory Safety:** Every directive that adds event listeners, intervals, or child elements MUST implement cleanup using `_onDispose` or `_disposeChildren`.
3. **No Build for Dev:** The framework must remain usable via CDN without a build step for the end-user.
4. **Consistency:** Follow Biome formatting and linting rules strictly. Use `bun x biome check --write .` before committing.
5. **Testing:** New features MUST include unit tests in `__tests__` and, if UI-heavy, E2E tests in `e2e/`. Minimum line coverage target is 90%.

## Architecture Summary
- **Reactive Engine:** Based on Proxies (see `src/context.js`).
- **Registry:** Central hub for all directives (see `src/registry.js`).
- **DOM Processing:** Uses `TreeWalker` for efficient element discovery.
