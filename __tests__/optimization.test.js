import { describe, expect, it, beforeEach } from "bun:test";
import NoJS from "../src/index.js";

describe("Optimizations (R11+R13)", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("should use lazy memo for computed properties (R11)", async () => {
		document.body.innerHTML = `
			<div id="app" state='{"a": 1, "b": 2}'>
				<div computed="sum" expr="a + b"></div>
				<div id="target" bind="sum"></div>
			</div>
		`;

		await NoJS.init();
		const appEl = document.getElementById("app");
		const targetEl = document.getElementById("target");
		
		expect(targetEl.textContent).toBe("3");

		// Spy on the getter would be ideal, but let's check functional behavior
		appEl.__ctx.a = 10;
		await Promise.resolve(); // R9 microtask
		expect(targetEl.textContent).toBe("12");
	});

	it("should avoid DOM mutation if value is the same (R13)", async () => {
		document.body.innerHTML = `
			<div id="app" state='{"name": "NoJS"}'>
				<div id="target" bind="name"></div>
			</div>
		`;

		await NoJS.init();
		const appEl = document.getElementById("app");
		const targetEl = document.getElementById("target");

		let mutationCount = 0;
		const observer = new MutationObserver(() => mutationCount++);
		observer.observe(targetEl, { characterData: true, childList: true, subtree: true });

		appEl.__ctx.name = "NoJS"; // Same value
		await Promise.resolve();
		expect(mutationCount).toBe(0);

		appEl.__ctx.name = "Updated"; // New value
		await Promise.resolve();
		expect(mutationCount).toBeGreaterThan(0);
		
		observer.disconnect();
	});
});
