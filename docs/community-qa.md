# Community Q&A

Questions and answers collected from Reddit discussions (r/javascript, r/HTML).

---

## General

### How do people do complex filters without JS?

They don't. The name "No.JS" doesn't mean you won't need JS for complex stuff, the idea is to **reduce** the amount of JavaScript you write. The name works for two reasons: it's a great marketing name, and there's the irony of a framework written in JS that says "No JS."

### How does No.JS compare to HTMX and Alpine.js?

**HTMX** nails the server-driven model, if your backend is the brain, HTMX wires the HTML to it beautifully. But it assumes a server that returns HTML fragments. If you have a static page and a public API, you'd still need to stand up a server just to proxy and template responses.

**Alpine.js** is closer, reactive, lightweight, stays in the HTML. But it lacks declarative HTTP, SPA routing, and built-in loops-over-fetched-data patterns. You end up writing `x-init` scripts and wiring up `x-for` separately.

No.JS is the **middle ground**: lives entirely in HTML like Alpine, talks to APIs like HTMX, but treats the whole lifecycle (fetch, bind, loop, route) as one continuous surface. Not a server story. Not a scripting story. An HTML story.

### How does this compare to progressive enhancement libraries like Alpine.js and Petite Vue?

No.JS shares the same philosophy of staying close to HTML, but goes further by including declarative HTTP fetching, SPA routing, i18n, form validation, animations, and 30+ built-in filters, all through HTML attributes. With Alpine or Petite Vue, you'd need to wire those up yourself or pull in additional libraries.

### Your framework reminds me of AngularJS (the original). Thoughts?

That's a fair comparison. The original AngularJS was also an attempt to wrestle web coding back to HTML. No.JS takes that same intuition but in a much lighter package (~20 KB gzipped, zero dependencies) and without the complexity that AngularJS grew into. The key difference: No.JS is designed for the use cases where a full framework is overkill.

### Have you tried Mavo?

Not yet at the time of the discussion, but it's on the radar. [Mavo](https://phd.verou.me/chapters/mavo/) takes a similar HTML-centric approach.

---

## Architecture & Scaling

### How does it scale when the UI logic gets more complex? How's state handled under the hood?

Business rules should stay in the backend. The frontend is the closest thing to the user, we shouldn't have complex and unsafe code being "decided" that close to a user.

No.JS uses JavaScript **Proxy** objects for reactivity. When you declare state with `state`, the framework wraps your data in a Proxy. Any time a property is set, the Proxy's `set` trap detects the change and notifies all registered watchers, which then update the DOM, no virtual DOM or diffing involved.

### How do you handle computed/derived state, async updates, and batching?

All handled by the framework:

**1. Computed/Derived State**: Use `computed` + `expr`. It recalculates when dependencies change:

```html
<div state="{ price: 100, quantity: 2 }">
  <div computed="total" expr="price * quantity"></div>
  <p>Total: $<span bind="total"></span></p>
</div>
```

No subscriptions, no manual wiring.

**2. Async**: `get`, `post`, etc. fetch data and drop it into the reactive context. Same Proxy, same watchers, same update cycle:

```html
<div get="/users/1" as="user">
  <h1 bind="user.name">Loading...</h1>
</div>
```

Need it elsewhere? `into` pipes it to a global store:

```html
<div get="/me" as="user" into="currentUser"></div>
<nav>
  <span bind="$store.currentUser.name"></span>
</nav>
```

**3. Batching**: Multiple changes at once? Watchers get deduped and only fire once. No redundant DOM updates. You don't even see this one, you write attributes, the framework reacts.

---

## Security

### What about XSS, expression injection, and security in general?

When your template language lives in HTML attributes and evaluates expressions at runtime, you're essentially handing the browser a tiny interpreter. Guardrails are in place:

- **Sandboxed evaluation**, no `Function` constructor on user-facing inputs
- **Scope isolation** between components
- **Expression whitelisting** to prevent arbitrary code execution

XSS surfaces, expression injection, and what happens when someone pipes unsanitized API data straight into a `bind` are areas being actively mapped out. Community input on CSP policies, template sanitization, and runtime sandboxing is welcome.

---

## Naming & Branding

### Why the name "No.JS"? People think it means no JavaScript at all.

The name works on two levels:

1. It means you **won't need to write thousands of lines of JS/TS** code to have your website running, the developer-facing layer is HTML attributes
2. The **irony**, it's a framework written entirely in JavaScript that says "No JS"

It's similar to NoSQL (Not Only SQL), people sometimes misinterpret it, but the spirit is about reducing, not eliminating.

The npm package is `@erickxavier/no-js` because the plain `no-js`, `nojs`, and `no.js` names were already taken by dead projects.

---

## Philosophy

### Aren't you just creating new conventions while hating on conventions?

Fair point! But No.JS conventions are **HTML attributes**, something browsers already understand. The difference is that instead of creating components, modules, services, interfaces, and observable pipes across six files just to filter a table, you write:

```html
<div state="{ query: '' }" get="/api/search?q={{ query }}" as="results">
  <input model="query" />
  <li each="r in results" bind="r.name"></li>
</div>
```

Four lines. The actual logic fits in a sentence.

### What's the target use case? Will it replace React?

It's **not** going to replace React for large team projects with complex tooling needs. That's not the goal. But for:

- Landing pages
- Dashboards
- Internal tools
- Prototypes
- Anything where you need something reactive without the ceremony

...it works well. ~20 KB gzipped, zero dependencies, no build step.
