import { describe, expect, it, beforeEach } from "bun:test";
import NoJS from "../src/index.js";

describe("Virtual List (R5+R12)", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		// Mock IntersectionObserver
		global.IntersectionObserver = class {
			constructor(cb) { this.cb = cb; }
			observe() { 
				// Immediately trigger intersection
				this.cb([{ isIntersecting: true }]);
			}
			unobserve() {}
			disconnect() {}
		};
	});

	it("should only render visible items in 'each' directive", async () => {
		document.body.innerHTML = `
			<div store="test" value='{"items": []}'></div>
			<template id="item-tpl">
				<div class="item" bind="item.id"></div>
			</template>
			<div id="list" each="item in $store.test.items" virtual virtual-height="20" template="item-tpl" style="height: 100px;"></div>
		`;

		await NoJS.init();
		const listEl = document.getElementById("list");
		const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
		
		NoJS.store.test.items = items;
		await Promise.resolve(); // wait for microtask (R9)

		// Viewport is 100px, item height 20px -> 5 items visible + 5 buffer above + 5 buffer below = ~15 items
		const renderedCount = listEl.querySelectorAll(".item").length;
		expect(renderedCount).toBeGreaterThan(5);
		expect(renderedCount).toBeLessThan(25);
		
		// Check first item id
		expect(listEl.querySelector(".item").textContent).toBe("0");
	});

	it("should update rendered items on scroll", async () => {
		document.body.innerHTML = `
			<div store="test" value='{"items": []}'></div>
			<template id="item-tpl">
				<div class="item" bind="item.id"></div>
			</template>
			<div id="list" each="item in $store.test.items" virtual virtual-height="20" template="item-tpl" style="height: 100px;"></div>
		`;

		await NoJS.init();
		const listEl = document.getElementById("list");
		const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
		
		NoJS.store.test.items = items;
		await Promise.resolve();

		// Simulate scroll
		listEl.scrollTop = 500; // Scroll down 25 items (25 * 20 = 500)
		listEl.dispatchEvent(new Event("scroll"));
		
		// Should now render items around index 25
		const firstRenderedId = parseInt(listEl.querySelector(".item").textContent, 10);
		expect(firstRenderedId).toBeGreaterThan(15);
		expect(firstRenderedId).toBeLessThan(25);
	});
});
