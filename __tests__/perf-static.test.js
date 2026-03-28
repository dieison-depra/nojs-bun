import { beforeEach, describe, expect, it } from "bun:test";
import NoJS from "../src/index.js";

describe("Phase 5: Static Hoisting Skipper", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("should skip elements with data-nojs-static", () => {
		const div = document.createElement("div");
		div.innerHTML = `
			<div id="dynamic" bind="name"></div>
			<div id="static" data-nojs-static bind="name">
				<span bind="name"></span>
			</div>
		`;
		document.body.appendChild(div);

		// We need to spy on processElement, but it's exported from registry.js
		// In ES modules, spying on exports can be tricky depending on the bundler/test runner.
		// Let's check if we can verify via side-effects (e.g. __declared flag).

		NoJS.processTree(div);

		const dynamicEl = document.getElementById("dynamic");
		const staticEl = document.getElementById("static");
		const staticChild = staticEl.querySelector("span");

		expect(dynamicEl.__declared).toBe(true);
		expect(staticEl.__declared).toBeUndefined(); // Should be skipped
		expect(staticChild.__declared).toBeUndefined(); // Should be skipped
	});
});
