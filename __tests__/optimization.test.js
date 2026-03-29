import { describe, expect, it, beforeEach } from "bun:test";
import NoJS from "../src/index.js";
import { processTree } from "../src/registry.js";

describe("Optimizations (R13)", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("should avoid DOM mutation if value is the same (R13)", async () => {
		document.body.innerHTML = `
			<div store="optStore" value='{"name": "NoJS"}'></div>
			<div id="target" bind="$store.optStore.name"></div>
		`;

		processTree(document.body);
		const targetEl = document.getElementById("target");

		let mutationCount = 0;
		const observer = new MutationObserver(() => mutationCount++);
		observer.observe(targetEl, { characterData: true, childList: true, subtree: true });

		NoJS.store.optStore.$set("name", "NoJS"); // Same value

		await Promise.resolve(); // Wait for MutationObserver microtask
		mutationCount += observer.takeRecords().length;
		expect(mutationCount).toBe(0);

		NoJS.store.optStore.$set("name", "Updated"); // New value
		await Promise.resolve();
		mutationCount += observer.takeRecords().length;
		expect(mutationCount).toBeGreaterThan(0);
		
		observer.disconnect();
	});
});
