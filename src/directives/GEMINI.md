# Directive Implementation Guide

## Implementation Pattern
All directives must follow this structure:
```javascript
registerDirective("name", {
  priority: 10,
  init(el, name, expr) {
    const ctx = findContext(el);
    // Setup logic...
    _onDispose(() => { /* cleanup */ });
  }
});
```

## Mandates for Directives
1. **Context Lookup:** Use `findContext(el)` to access the nearest reactive state.
2. **Reactivity:** Always use `_watchExpr(expr, ctx, callback)` for data-driven UI updates.
3. **Template Handling:** If replacing innerHTML, use `_disposeChildren(el)` before clearing to avoid memory leaks.
4. **Dynamic Names:** Use pattern matching (e.g., `class-*`) for directives that take sub-names.

## Standard Priorities
- `state`: 0 (Critical - defines data)
- `http`: 1 (Early - fetches data)
- `if`/`each`: 10 (Structure)
- `bind`: 20 (UI update)
- `on`: 20 (Events)
- `ref`: 50 (Identity)
