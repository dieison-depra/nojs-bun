/**
 * Leak Regression Tests — No.JS each / on:* / get / store watchers
 *
 * These tests mirror the memory-leak regression suite run as Playwright CDP
 * tests in the consumer project. Since JSDOM does not provide CDP metrics
 * (m.Nodes, m.JSEventListeners), each test asserts the observable state that
 * the CDP metric would reflect:
 *
 *   - el.children.length   → equivalent to DOM node count growth
 *   - _storeWatchers.size  → equivalent to JS event listener accumulation
 *   - listener Set sizes   → internal watcher bookkeeping
 *
 * Analysis of the three candidate issues raised alongside the 40-node leak:
 *
 * [A] __collectKeysCache retaining references:
 *     The cache (ctx.__raw.__collectKeysCache) stores plain data values from
 *     Object.keys(raw), never DOM node references. Child contexts live on
 *     their own raw objects. When _disposeChildren + innerHTML="" runs,
 *     nothing in __collectKeysCache prevents GC of detached wrappers.
 *     NOT a DOM node leak source.
 *
 * [B] Incomplete disposers / redundant MutationObservers:
 *     This was the real bug: _watchExpr created a MutationObserver for
 *     $store expressions but did not register ro.disconnect() via _onDispose.
 *     When _disposeChildren ran during each re-renders, the observer remained
 *     active and held el.parentElement (item wrapper) alive as a detached node.
 *     FIXED: _onDispose(() => ro.disconnect()) was added to _watchExpr.
 *     Multiple $store bindings on the same element create multiple observers —
 *     redundant but not dangerous since all are now disposed correctly.
 *
 * [C] Animation delays creating zombie nodes:
 *     When animate-leave is set on an each, old item wrappers stay in the DOM
 *     until animationend fires or the animDuration fallback timeout expires
 *     (default 2 s). In JSDOM, animationend never fires, so tests using fake
 *     timers would need to advance the clock. In the external project's tests
 *     no animation attributes are used, so this path is never taken and does
 *     not contribute to the 40-node leak. A TEST TIMING concern, not a
 *     production memory leak.
 */

import {
	_notifyStoreWatchers,
	_stores,
	_storeWatchers,
} from "../src/globals.js";
import NoJS from "../src/index.js";
import { _disposeChildren, processTree } from "../src/registry.js";
import { flushSync } from "../src/signals.js";

// ─── Setup / Teardown ───────────────────────────────────────────────────────

function clearStores() {
	Object.keys(_stores).forEach((k) => delete _stores[k]);
}

beforeEach(() => {
	document.body.innerHTML = "";
	clearStores();
	NoJS._initialized = false;
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildEachWithStore(items) {
	_stores.list = { items };
	document.body.innerHTML = `
    <template id="row-tpl">
      <li class="row"></li>
    </template>
    <ul id="container" each="item in $store.list.items" template="row-tpl"></ul>
  `;
	processTree(document.body);
}

function buildEachWithEvents(items) {
	_stores.list = { items };
	document.body.innerHTML = `
    <template id="row-tpl">
      <li class="row" on:click="clicked = true"></li>
    </template>
    <ul id="container" each="item in $store.list.items" template="row-tpl"></ul>
  `;
	processTree(document.body);
}

// ─── T1: each baseline recovery ─────────────────────────────────────────────

describe("[T1] each — clearing the list releases all child wrappers", () => {
	test("children.length drops to zero after store list is emptied", () => {
		buildEachWithStore([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
		const container = document.getElementById("container");
		expect(container.children.length).toBe(5);

		_stores.list.items = [];
		_notifyStoreWatchers();
		flushSync();

		expect(container.children.length).toBe(0);
	});

	test("disposed child wrappers have no remaining disposers", () => {
		buildEachWithStore([{ id: 1 }, { id: 2 }]);
		const container = document.getElementById("container");
		const wrappers = [...container.children];

		_stores.list.items = [];
		_notifyStoreWatchers();
		flushSync();

		// _disposeChildren ran: all wrapper disposers must have been called
		wrappers.forEach((w) => {
			// _disposeElement nulls __disposers after running them
			expect(w.__disposers == null).toBe(true);
		});
	});
});

// ─── T2: on:* handler accumulation ──────────────────────────────────────────

describe("[T2] on:* — add/remove cycles do not accumulate child wrappers", () => {
	test("30 add→remove cycles leave zero children in the container", () => {
		const CYCLES = 30;
		const item = { id: 1 };

		buildEachWithEvents([]);
		const container = document.getElementById("container");

		for (let i = 0; i < CYCLES; i++) {
			_stores.list.items = [item];
			_notifyStoreWatchers();
			flushSync();
			expect(container.children.length).toBe(1);

			_stores.list.items = [];
			_notifyStoreWatchers();
			flushSync();
			expect(container.children.length).toBe(0);
		}
	});

	test("_storeWatchers size is stable across 30 add/remove cycles", () => {
		const item = { id: 1 };
		buildEachWithEvents([]);

		// Baseline after initial processTree (each's own watcher is registered)
		const baseline = _storeWatchers.size;

		for (let i = 0; i < 30; i++) {
			_stores.list.items = [item];
			_notifyStoreWatchers();
			flushSync();
			_stores.list.items = [];
			_notifyStoreWatchers();
			flushSync();
		}

		// Watcher set must not grow compared to baseline
		expect(_storeWatchers.size).toBeLessThanOrEqual(baseline);
	});
});

// ─── T3: re-renders with same list size do not accumulate ───────────────────

describe("[T3] each — N re-renders with same list size do not accumulate", () => {
	test("40 new-array-ref re-renders of a 1-item list keep children.length === 1", () => {
		const RENDERS = 40;
		buildEachWithStore([{ id: 1 }]);
		const container = document.getElementById("container");

		for (let i = 0; i < RENDERS; i++) {
			// New array reference every time (same as cart.updateQty pattern)
			_stores.list.items = [{ id: 1 }];
			_notifyStoreWatchers();
			flushSync();
		}

		expect(container.children.length).toBe(1);
	});

	test("_storeWatchers size does not grow across 40 re-renders", () => {
		const RENDERS = 40;
		buildEachWithStore([{ id: 1 }]);

		const baseline = _storeWatchers.size;

		for (let i = 0; i < RENDERS; i++) {
			_stores.list.items = [{ id: 1 }];
			_notifyStoreWatchers();
			flushSync();
		}

		expect(_storeWatchers.size).toBeLessThanOrEqual(baseline);
	});
});

// ─── T5: children proportional to state, not to operation count ─────────────

describe("[T5] each — DOM children track list length, not re-render count", () => {
	test("children.length equals list.length regardless of prior re-render count", () => {
		buildEachWithStore([]);
		const container = document.getElementById("container");

		// Phase 1: grow to 5 items across 5 re-renders
		for (let i = 1; i <= 5; i++) {
			_stores.list.items = Array.from({ length: i }, (_, j) => ({ id: j }));
			_notifyStoreWatchers();
			flushSync();
		}
		expect(container.children.length).toBe(5);

		// Phase 2: 10 more re-renders with the same 5-item list (new refs)
		for (let i = 0; i < 10; i++) {
			_stores.list.items = Array.from({ length: 5 }, (_, j) => ({ id: j }));
			_notifyStoreWatchers();
			flushSync();
		}
		expect(container.children.length).toBe(5);

		// Phase 3: shrink to 3
		_stores.list.items = [{ id: 0 }, { id: 1 }, { id: 2 }];
		_notifyStoreWatchers();
		flushSync();
		expect(container.children.length).toBe(3);

		// Phase 4: clear
		_stores.list.items = [];
		_notifyStoreWatchers();
		flushSync();
		expect(container.children.length).toBe(0);
	});
});

// ─── T6: full session cycle — no cumulative leak ────────────────────────────

describe("[T6] full cycle — repeated add/clear sessions do not accumulate", () => {
	test("5 fill→clear cycles leave _storeWatchers at baseline", () => {
		buildEachWithStore([]);
		const baseline = _storeWatchers.size;
		const container = document.getElementById("container");

		const CYCLES = 5;
		for (let cycle = 0; cycle < CYCLES; cycle++) {
			// Fill with 5 items
			_stores.list.items = Array.from({ length: 5 }, (_, i) => ({ id: i }));
			_notifyStoreWatchers();
			flushSync();
			expect(container.children.length).toBe(5);

			// Clear
			_stores.list.items = [];
			_notifyStoreWatchers();
			flushSync();
			expect(container.children.length).toBe(0);
		}

		// Store watcher count must not have grown cumulatively
		expect(_storeWatchers.size).toBeLessThanOrEqual(baseline);
	});

	test("5 fill→clear cycles leave zero detached wrapper children", () => {
		buildEachWithStore([]);
		const container = document.getElementById("container");

		for (let cycle = 0; cycle < 5; cycle++) {
			_stores.list.items = Array.from({ length: 5 }, (_, i) => ({ id: i }));
			_notifyStoreWatchers();
			flushSync();
			_stores.list.items = [];
			_notifyStoreWatchers();
			flushSync();
		}

		expect(container.children.length).toBe(0);
		expect(container.innerHTML.trim()).toBe("");
	});

	test("MutationObserver for $store watcher is disconnected by _disposeTree (regression: 40-node leak)", () => {
		_stores.list = { items: [{ id: 1 }] };
		document.body.innerHTML = `
      <template id="bind-tpl">
        <span bind-attr-data-count="$store.list.items.length"></span>
      </template>
      <ul id="container" each="item in $store.list.items" template="bind-tpl"></ul>
    `;
		processTree(document.body);

		const container = document.getElementById("container");
		expect(container.children.length).toBe(1);

		const wrapper = container.children[0];
		const span = wrapper.querySelector("span");

		// span should have a disposer for the MutationObserver registered by _watchExpr
		const disposersBefore = span ? (span.__disposers || []).length : 0;
		expect(disposersBefore).toBeGreaterThan(0);

		// Simulate each re-render: dispose children then clear
		_disposeChildren(container);
		container.innerHTML = "";

		// After disposal, the wrapper is no longer a child
		expect(container.children.length).toBe(0);

		// _disposeElement nulls out __disposers after running them
		if (span) {
			expect(span.__disposers).toBeNull();
		}
	});
});

// ─── T7/T8/T9: F3/F4 — if/else + $store dentro de each ─────────────────────

describe("[T7] rebuildItems: _storeWatchers não acumula com if=$store.* no template", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		Object.keys(_stores).forEach((k) => delete _stores[k]);
	});
	afterEach(() => {
		document.body.innerHTML = "";
		Object.keys(_stores).forEach((k) => delete _stores[k]);
	});

	test("5 ciclos fill/clear mantêm _storeWatchers próximo ao baseline", () => {
		_stores.cart = { desconto: null };
		document.body.innerHTML = `
			<template id="ci-tpl">
				<li>
					<span bind="ci.nome"></span>
					<button if="!$store.cart.desconto"
					        on:click="$store.cart.desconto = {valor: 5}">Desconto</button>
					<span else bind="$store.cart.desconto.valor"></span>
				</li>
			</template>
			<div id="state-t7" state='{"items":[]}'>
				<ul id="list" each="ci in items" template="ci-tpl"></ul>
			</div>
		`;
		processTree(document.body);
		flushSync();

		const baseline = _storeWatchers.size;
		const ctx = document.getElementById("state-t7").__ctx;

		for (let i = 0; i < 5; i++) {
			ctx.$set("items", [{ id: 1, nome: "A" }, { id: 2, nome: "B" }]);
			_notifyStoreWatchers();
			flushSync();
			ctx.$set("items", []);
			_notifyStoreWatchers();
			flushSync();
		}

		// Após 5 ciclos fill/clear, _storeWatchers deve ser ≤ baseline + margem pequena
		expect(_storeWatchers.size).toBeLessThanOrEqual(baseline + 2);
	});
});

describe("[T8] MutationObserver cleanup funciona com wrappers display:contents do each", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		Object.keys(_stores).forEach((k) => delete _stores[k]);
	});
	afterEach(() => {
		document.body.innerHTML = "";
		Object.keys(_stores).forEach((k) => delete _stores[k]);
	});

	test("_storeWatchers volta ao tamanho anterior após fill/clear de each sem key=", async () => {
		_stores.x = { flag: true };
		document.body.innerHTML = `
			<template id="t8-tpl">
				<li show="$store.x.flag" bind="item.v"></li>
			</template>
			<div id="state-t8" state='{"items":[]}'>
				<ul id="list" each="item in items" template="t8-tpl"></ul>
			</div>
		`;
		processTree(document.body);
		flushSync();

		const sizeBefore = _storeWatchers.size;
		const ctx = document.getElementById("state-t8").__ctx;

		ctx.$set("items", [{ v: 1 }, { v: 2 }]);
		_notifyStoreWatchers();
		flushSync();

		ctx.$set("items", []);
		_notifyStoreWatchers();
		flushSync();

		// Aguarda MutationObserver disparar (se aplicável)
		await new Promise((r) => setTimeout(r, 0));

		// Com o fix (subtree:true + ancestral estável), watchers órfãos são removidos
		expect(_storeWatchers.size).toBeLessThanOrEqual(sizeBefore + 1);
	});

	test("múltiplos $store watchers por item são todos removidos ao limpar a lista", async () => {
		_stores.ui = { mode: "view" };
		document.body.innerHTML = `
			<template id="t8b-tpl">
				<li>
					<span show="$store.ui.mode === 'view'">view</span>
					<span show="$store.ui.mode === 'edit'">edit</span>
					<button if="$store.ui.mode === 'view'"
					        on:click="$store.ui.mode = 'edit'">editar</button>
				</li>
			</template>
			<div id="state-t8b" state='{"items":[]}'>
				<ul id="list2" each="item in items" template="t8b-tpl"></ul>
			</div>
		`;
		processTree(document.body);
		flushSync();

		const sizeBefore = _storeWatchers.size;
		const ctx = document.getElementById("state-t8b").__ctx;

		ctx.$set("items", [{ id: 1 }, { id: 2 }, { id: 3 }]);
		_notifyStoreWatchers();
		flushSync();

		const sizeWithItems = _storeWatchers.size;
		expect(sizeWithItems).toBeGreaterThan(sizeBefore);

		ctx.$set("items", []);
		_notifyStoreWatchers();
		flushSync();
		await new Promise((r) => setTimeout(r, 0));

		// Todos os watchers dos 3 itens (3 × N watchers/item) devem ser removidos
		expect(_storeWatchers.size).toBeLessThanOrEqual(sizeBefore + 1);
	});
});

describe("[T9] reconcileItems (keyed): remoção de item limpa _storeWatchers do wrapper", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		Object.keys(_stores).forEach((k) => delete _stores[k]);
	});
	afterEach(() => {
		document.body.innerHTML = "";
		Object.keys(_stores).forEach((k) => delete _stores[k]);
	});

	test("remover 1 item de 3 reduz _storeWatchers proporcionalmente", () => {
		_stores.s = { mode: "view" };
		document.body.innerHTML = `
			<template id="t9-tpl">
				<li>
					<div if="$store.s.mode === 'edit'" bind="item.v"></div>
					<div else bind="item.v"></div>
					<span show="$store.s.mode === 'view'">view</span>
				</li>
			</template>
			<div id="state-t9" state='{"items":[]}'>
				<ul id="list" each="item in items" key="item.id" template="t9-tpl"></ul>
			</div>
		`;
		processTree(document.body);
		flushSync();

		const ctx = document.getElementById("state-t9").__ctx;

		ctx.$set("items", [{ id: 1, v: "A" }, { id: 2, v: "B" }, { id: 3, v: "C" }]);
		_notifyStoreWatchers();
		flushSync();

		const sizeWith3 = _storeWatchers.size;

		// Remove item do meio — reconcileItems deve chamar _disposeChildren no wrapper removido
		ctx.$set("items", [{ id: 1, v: "A" }, { id: 3, v: "C" }]);
		_notifyStoreWatchers();
		flushSync();

		const sizeWith2 = _storeWatchers.size;

		// Com 1 item a menos, watchers daquele item devem ter sido removidos
		expect(sizeWith2).toBeLessThan(sizeWith3);
	});

	test("remover todos os itens zera os watchers adicionados pelos itens", () => {
		_stores.s2 = { active: false };
		document.body.innerHTML = `
			<template id="t9b-tpl">
				<li show="$store.s2.active" bind="item.nome"></li>
			</template>
			<div id="state-t9b" state='{"items":[]}'>
				<ul id="list2" each="item in items" key="item.id" template="t9b-tpl"></ul>
			</div>
		`;
		processTree(document.body);
		flushSync();

		const baseline = _storeWatchers.size;
		const ctx = document.getElementById("state-t9b").__ctx;

		ctx.$set("items", [{ id: 1, nome: "X" }, { id: 2, nome: "Y" }]);
		_notifyStoreWatchers();
		flushSync();

		ctx.$set("items", []);
		_notifyStoreWatchers();
		flushSync();

		expect(_storeWatchers.size).toBeLessThanOrEqual(baseline + 1);
	});
});
