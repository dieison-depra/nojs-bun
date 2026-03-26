/**
 * Bun Test Setup — Native Bun + JSDOM (Stability Patches)
 */

import { jest } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
	url: "http://localhost/",
	contentType: "text/html",
	includeNodeLocations: true,
	storageQuota: 10000000,
});

const { window } = dom;

// Register GLOBALLY for the test environment
globalThis.window = window;
globalThis.document = window.document;
globalThis.navigator = window.navigator;
globalThis.location = window.location;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLTemplateElement = window.HTMLTemplateElement;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MutationObserver = window.MutationObserver;
globalThis.NodeFilter = window.NodeFilter;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.FocusEvent = window.FocusEvent;
globalThis.InputEvent = window.InputEvent;
globalThis.UIEvent = window.UIEvent;
globalThis.ErrorEvent = window.ErrorEvent;
globalThis.DOMParser = window.DOMParser;
globalThis.XMLSerializer = window.XMLSerializer;
globalThis.atob = (str) => Buffer.from(str, "base64").toString("binary");
globalThis.btoa = (str) => Buffer.from(str, "binary").toString("base64");
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;
globalThis.History = window.History;
globalThis.history = window.history;
globalThis.AbortController =
	window.AbortController || globalThis.AbortController;

// PATCH: Prevent infinite recursion in navigator properties (Bun + JSDOM bug)
Object.defineProperty(globalThis.navigator, "hardwareConcurrency", {
	value: 1,
	configurable: true,
});
Object.defineProperty(globalThis.navigator, "userAgent", {
	value: "Bun/JSDOM",
	configurable: true,
});

// PATCH: Fix JSDOM dispatchEvent type check
const originalDispatch = window.EventTarget.prototype.dispatchEvent;
window.EventTarget.prototype.dispatchEvent = function (event) {
	if (!(event instanceof window.Event) && event.type) {
		const wrapped = new window.CustomEvent(event.type, {
			detail: event.detail,
			bubbles: true,
			cancelable: true,
		});
		return originalDispatch.call(this, wrapped);
	}
	return originalDispatch.call(this, event);
};

// Compatibility: Map global jest to Bun's test runner
globalThis.jest = jest;

// Mocking requestAnimationFrame (16ms for rAF simulation in tests)
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
