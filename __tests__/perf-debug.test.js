import { beforeEach, describe, expect, it } from "bun:test";
import { createContext } from "../src/context.js";
import NoJS from "../src/index.js";

describe("Directives Debug", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("should process bind correctly", async () => {
		const el = document.createElement("div");
		el.setAttribute("bind", "name");
		document.body.appendChild(el);

		const ctx = createContext({ name: "World" });
		el.__ctx = ctx;

		NoJS.processTree(el);

		expect(el.textContent).toBe("World");
	});

	it("should process bind-title correctly", async () => {
		const el = document.createElement("div");
		el.setAttribute("bind-title", "name");
		document.body.appendChild(el);

		const ctx = createContext({ name: "World" });
		el.__ctx = ctx;

		NoJS.processTree(el);

		expect(el.getAttribute("title")).toBe("World");
	});
});
