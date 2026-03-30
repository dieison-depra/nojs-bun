import { describe, expect, it, beforeEach } from "bun:test";
import NoJS from "../src/index.js";
import { processTree } from "../src/registry.js";
import { flushSync } from "../src/signals.js";

describe("Virtual List (R5+R12)", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		// Mock IntersectionObserver
		global.IntersectionObserver = class {
			constructor(cb) { this.cb = cb; }
			observe() { 
				this.cb([{ isIntersecting: true }]);
			}
			unobserve() {}
			disconnect() {}
		};
	});

	it("should only render visible items in 'each' directive", () => {
		document.body.innerHTML = `
			<div store="vlist1" value='{"items": []}'></div>
			<template id="item-tpl-1">
				<div class="item" bind="item.id"></div>
			</template>
			<div id="list1" each="item in $store.vlist1.items" virtual virtual-height="20" template="item-tpl-1" style="height: 100px;"></div>
		`;

		const listEl = document.getElementById("list1");
		Object.defineProperty(listEl, 'clientHeight', { value: 100 });
		
		processTree(document.body);
		
		const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
		NoJS.store.vlist1.$set("items", items);
		flushSync();

		const renderedCount = listEl.querySelectorAll(".item").length;
		expect(renderedCount).toBeGreaterThan(5);
		expect(renderedCount).toBeLessThan(25);
		expect(listEl.querySelector(".item").textContent).toBe("0");
	});

	it("should update rendered items on scroll", () => {
		document.body.innerHTML = `
			<div store="vlist2" value='{"items": []}'></div>
			<template id="item-tpl-2">
				<div class="item" bind="item.id"></div>
			</template>
			<div id="list2" each="item in $store.vlist2.items" virtual virtual-height="20" template="item-tpl-2" style="height: 100px;"></div>
		`;

		const listEl = document.getElementById("list2");
		Object.defineProperty(listEl, 'clientHeight', { value: 100 });
		
		processTree(document.body);

		const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
		NoJS.store.vlist2.$set("items", items);
		flushSync();

		listEl.scrollTop = 500;
		listEl.dispatchEvent(new Event("scroll"));
		flushSync();

		const itemEl = listEl.querySelector(".item");
		if (!itemEl) {
			console.error("listEl HTML:", listEl.outerHTML);
			throw new Error("Item not found");
		}
		const firstRenderedId = parseInt(itemEl.textContent, 10);
		expect(firstRenderedId).toBeGreaterThan(15);
		expect(firstRenderedId).toBeLessThan(25);
	});
});
