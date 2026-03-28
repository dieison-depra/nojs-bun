import { beforeEach, describe, expect, it, jest } from "bun:test";
import { createContext } from "../src/context.js";
import NoJS from "../src/index.js";

describe("Phase 3: Global Event Manager", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("should expose window.nojs.run for external delegation scripts", () => {
		expect(typeof window.nojs.run).toBe("function");
	});

	it("should execute expression via nojs.run in the correct context", () => {
		const el = document.createElement("div");
		const ctx = createContext({ count: 0 });
		el.__ctx = ctx;
		document.body.appendChild(el);

		window.nojs.run("count++", el);
		expect(ctx.count).toBe(1);
	});

	it("should NOT attach individual listener if data-nojs-event is present", () => {
		const el = document.createElement("button");
		el.setAttribute("on:click", "count++");
		el.setAttribute("data-nojs-event", "click");

		const addSpy = jest.spyOn(el, "addEventListener");

		// In No.JS, directives are processed via processTree or processElement
		NoJS.processTree(el);

		// It should NOT have called addEventListener for 'click'
		const clickCalls = addSpy.mock.calls.filter((call) => call[0] === "click");
		expect(clickCalls.length).toBe(0);
	});

	it("should STILL attach individual listener if modifiers are present", () => {
		const el = document.createElement("button");
		el.setAttribute("on:click.stop", "count++");
		el.setAttribute("data-nojs-event", "click"); // CLI might have added this too

		const addSpy = jest.spyOn(el, "addEventListener");

		NoJS.processTree(el);

		// It SHOULD have called addEventListener because of .stop modifier
		// (which global manager doesn't handle yet in this implementation)
		const clickCalls = addSpy.mock.calls.filter((call) => call[0] === "click");
		expect(clickCalls.length).toBe(1);
	});
});
