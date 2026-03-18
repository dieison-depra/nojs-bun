# Core Architecture & Internal API

## System Design
The core is divided into specialized modules:
- `registry.js`: Manages directive registration and the `processTree` lifecycle.
- `context.js`: Implements the reactive Proxy system for data binding.
- `evaluate.js`: A custom expression parser and statement interpreter.
- `dom.js`: Helpers for DOM manipulation, template cloning, and context lookup.
- `globals.js`: Shared configuration and the central Event Bus.

## Processing Lifecycle
1. **Discovery:** `processTree` uses `TreeWalker` to find elements with attributes starting with registered directive names.
2. **Priority:** Directives are executed in order of their `priority` property (lowest number = highest priority).
3. **Initialization:** The `init(el, name, expr)` function of each directive is called.
4. **Reactivity:** Directives use `ctx.$watch()` to react to state changes.

## Critical Internal Methods
- `_disposeTree(el)`: Recursively cleans up all resources associated with an element.
- `_onDispose(fn)`: Registers a cleanup callback for the element currently being processed.
- `_setCurrentEl(el)`: Internal state tracker used during initialization to link watchers to elements.
