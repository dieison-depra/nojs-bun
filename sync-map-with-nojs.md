# Sync Map: nojs-bun ↔ no-js (upstream)

## Repositories

| Role | URL | Branch | Last Synced Commit | Last Synced Tag |
|------|-----|--------|--------------------|-----------------|
| **Fork (this repo)** | `git@github.com:dieison-depra/nojs-bun.git` | `main` | `8479851` | `v1.10.1` |
| **Fork origin (no-js-erick)** | `git@github.com:dieison-depra/no-js.git` | `main` | `6cf5267` | — |
| **Upstream** | `https://github.com/ErickXavier/no-js` | `main` | `6cf5267` | `v1.11.0` @ `6fbde9f` |

> The fork `dieison-depra/no-js` has `upstream` remote pointing to `ErickXavier/no-js` and is kept in sync with it.
> The fork `dieison-depra/nojs-bun` is the Bun.js migration of that fork.

---

## Sync History

### Session 2026-03-26 — v1.10.1 → v1.11.0

**Range synced:** `v1.10.1..v1.11.0` (upstream ErickXavier/no-js)
**Upstream v1.11.0 tag commit:** `6fbde9f` (2026-03-26)
**nojs-bun base commit at start:** `8479851`

All items below were ported in this session. Status: ✅ **COMPLETE**

| # | Feature | Files Changed | Status |
|---|---------|---------------|--------|
| 1 | **Head directives** (`page-title`, `page-description`, `page-canonical`, `page-jsonld`) | `src/directives/head.js` (created), `src/index.js` | ✅ Done |
| 2 | **Router `_applyRouteHeadAttrs()`** — meta tags via route template attributes | `src/router.js` | ✅ Done |
| 3 | **Router `_interpolateRaw()`** — `{expr}` interpolation helper for JSON-LD | `src/router.js` | ✅ Done |
| 4 | **Router `focusBehavior`** — a11y focus on navigation (`"none"` \| `"auto"`) | `src/globals.js`, `src/router.js` | ✅ Done |
| 5 | **Router `suppressHashWarning`** — silence hash-mode console warning | `src/globals.js`, `src/router.js` | ✅ Done |
| 6 | **Test: `directives-head.test.js`** — 13 unit tests for head directives | `__tests__/directives-head.test.js` | ✅ Done |
| 7 | **Test: `inject-head-attrs.test.js`** — tests for `_applyRouteHeadAttrs` | `__tests__/inject-head-attrs.test.js` | ✅ Done |
| 8 | **Test: `audit-changes.test.js`** — API export audit (adapted CJS→ESM) | `__tests__/audit-changes.test.js` | ✅ Done |
| 9 | **Test: `leak-regression.test.js`** — T1–T6 memory leak regression tests | `__tests__/leak-regression.test.js` | ✅ Done |
| 10 | **Benchmark: `keyed-vs-rebuild.bench.spec.ts`** | `__benchmarks__/keyed-vs-rebuild.bench.spec.ts` | ✅ Done |
| 11 | **Version bump** `1.10.1` → `1.11.0` | `package.json` | ✅ Done |

**Test results after sync:**
- Unit tests: 1370 total, 3 pre-existing failures (unrelated to sync — router popstate, anchor link, validation reset)
- 66 new tests added, all passing

---

## What Was NOT Ported (intentional — nojs-bun exclusives)

These are improvements made in the Bun migration that must not be reverted:

| Item | Reason to keep |
|------|---------------|
| `@biomejs/biome` | Modern lint/format, replaces ESLint/Babel |
| `bun:test` as test runner | Native Bun, replaces Jest |
| `happy-dom` as alternate test env | Complements jsdom in Bun |
| `knip` (dead code analysis) | Quality addition |
| `"type": "module"` in package.json | Required for native ESM in Bun |
| `original-v1.10.1/` snapshot dir | Reference backup, keep |
| Extras in `evaluate.js`, `dom.js`, `context.js`, `index.js` | Fork-specific expansions |
| `__tests__/setup.js` (browser API bridge) | Bun-specific compatibility shim |
| `bunfig.toml` | Bun test configuration |
| `build.js` using `Bun.build` | Native Bun build (was esbuild) |

---

## How to Do the Next Sync

### Step 1 — Find what's new upstream since v1.11.0

```bash
# In the dieison-depra/no-js repo (which tracks ErickXavier/no-js):
git fetch upstream
git log v1.11.0..upstream/main --oneline

# Or compare tags directly:
git log v1.11.0..HEAD --oneline  # after pulling upstream/main into fork
```

### Step 2 — Identify the new upstream tag

```bash
git tag --sort=-version:refname | head -5
# Note the tag name, e.g. v1.12.0
git show v1.12.0 --stat
```

### Step 3 — List changed files in the range

```bash
git diff v1.11.0..v1.12.0 --name-only
```

### Step 4 — Evaluate each changed file

For each file that changed upstream, determine:
- Is it a **functional change** (port it)?
- Is it a **Bun-incompatible pattern** (adapt it)?
- Is it a **doc/infra change** (skip or adapt)?

Focus on `src/` and `__tests__/`. Skip CI/CD workflows (`.github/`) unless relevant.

### Step 5 — Port and adapt

- Copy functional code from `dieison-depra/no-js` (or `ErickXavier/no-js`)
- Adapt style to Biome conventions (tabs, double quotes)
- Adapt any `require()` / CJS patterns to ESM `import`
- Adapt any `jest.*` globals (most are available in `bun:test` already)
- Use `import.meta.dir` instead of `__dirname`

### Step 6 — Update this file

After completing a sync session, update:
1. The **Repositories** table: update `Last Synced Commit` and `Last Synced Tag` for the fork row
2. Add a new **Sync History** section with the range, date, and what was ported
3. Update `CHANGELOG.md` with the new version entry

---

## Git Reference Commands

```bash
# Check nojs-bun current state
cd /Users/dieisondepra/workspace/playground/nojs-bun
git log --oneline -5
git tag --sort=-version:refname | head -5

# Check upstream state (from no-js-erick fork)
cd /Users/dieisondepra/workspace/playground/no-js-erick
git log --oneline -5
git tag --sort=-version:refname | head -5
git log v1.11.0..HEAD --oneline  # what's newer than last synced tag

# Upstream ErickXavier/no-js
# Remote is configured as 'upstream' in dieison-depra/no-js
git fetch upstream
git log v1.11.0..upstream/main --oneline
```
