import { describe, it, expect, beforeEach } from "bun:test";
import NoJS from "../src/index.js";
import { createContext } from "../src/context.js";

describe("Phase 4: Template Cloning Engine", () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it("should clone from template specified by data-nojs-template", async () => {
		const template = document.createElement('template');
		template.id = 'nt-test';
		template.innerHTML = '<li bind="item"></li>';
		document.body.appendChild(template);

		const list = document.createElement('ul');
		list.setAttribute('each', 'item in items');
		list.setAttribute('data-nojs-template', 'nt-test');
		document.body.appendChild(list);

		const ctx = createContext({ items: ['A', 'B'] });
		list.__ctx = ctx;

		NoJS.processTree(document.body);

		expect(list.children.length).toBe(2);
		
		const li1 = list.children[0].querySelector('li') || list.children[0].firstElementChild;
		expect(li1.textContent).toBe('A');
		
		const li2 = list.children[1].querySelector('li') || list.children[1].firstElementChild;
		expect(li2.textContent).toBe('B');
	});

	it("should work with foreach and data-nojs-template", async () => {
		const template = document.createElement('template');
		template.id = 'nt-foreach';
		template.innerHTML = '<span bind="val"></span>';
		document.body.appendChild(template);

		const div = document.createElement('div');
		div.setAttribute('foreach', 'val');
		div.setAttribute('from', 'list');
		div.setAttribute('data-nojs-template', 'nt-foreach');
		document.body.appendChild(div);

		const ctx = createContext({ list: ['X', 'Y', 'Z'] });
		div.__ctx = ctx;

		NoJS.processTree(document.body);

		expect(div.children.length).toBe(3);
		const span1 = div.children[0].querySelector('span') || div.children[0].firstElementChild;
		expect(span1.textContent).toBe('X');
	});
});
