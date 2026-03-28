// ═══════════════════════════════════════════════════════════════════════
//  DIRECTIVE REGISTRY & DOM PROCESSING
// ═══════════════════════════════════════════════════════════════════════

import { _ctxRegistry, _devtoolsEmit } from "./devtools.js";
import { _currentEl, _setCurrentEl, _storeWatchers, _warn } from "./globals.js";
import { _i18nListeners } from "./i18n.js";

const _directives = new Map();
let _frozen = false;
const _coreDirectives = new Set();

export function registerDirective(name, handler) {
	if (_frozen && _coreDirectives.has(name)) {
		_warn(`Cannot override core directive "${name}".`);
		return;
	}
	_directives.set(name, {
		priority: handler.priority ?? 50,
		init: handler.init,
	});
	if (!_frozen) _coreDirectives.add(name);
}

export function _freezeDirectives() {
	_frozen = true;
}

function _matchDirective(attrName) {
	if (_directives.has(attrName)) {
		return { directive: _directives.get(attrName), match: attrName };
	}
	// Pattern matches
	const patterns = ["class-*", "on:*", "style-*", "bind-*"];
	for (const p of patterns) {
		const prefix = p.replace("*", "");
		// Special case: bind is exact match, bind-* is pattern
		if (p === "bind-*" && attrName === "bind") continue;

		if (attrName.startsWith(prefix) && _directives.has(p)) {
			return { directive: _directives.get(p), match: p };
		}
	}
	return null;
}

export function processElement(el) {
	if (el.__declared) return;
	el.__declared = true;

	const matched = [];
	for (const attr of [...el.attributes]) {
		const m = _matchDirective(attr.name);
		if (m) {
			matched.push({
				name: attr.name,
				value: attr.value,
				priority: m.directive.priority,
				init: m.directive.init,
			});
		}
	}

	matched.sort((a, b) => a.priority - b.priority);
	const prev = _currentEl;
	for (const m of matched) {
		_setCurrentEl(el);
		m.init(el, m.name, m.value);
	}
	_setCurrentEl(prev);

	if (matched.length > 0) {
		_devtoolsEmit("directive:init", {
			element: el.tagName?.toLowerCase(),
			directives: matched.map((m) => ({ name: m.name, value: m.value })),
		});
	}
}

export function processTree(root) {
	if (!root) return;
	if (root.nodeType === 1 && !root.__declared) {
		if (root.hasAttribute?.("data-nojs-static")) return;
		processElement(root);
	}
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
		acceptNode(node) {
			if (node.hasAttribute("data-nojs-static"))
				return NodeFilter.FILTER_REJECT;
			if (node.tagName === "TEMPLATE" || node.tagName === "SCRIPT")
				return NodeFilter.FILTER_SKIP;
			return NodeFilter.FILTER_ACCEPT;
		},
	});
	while (walker.nextNode()) {
		const node = walker.currentNode;
		if (!node.__declared) processElement(node);
	}
}

// ─── Disposal: proactive cleanup of watchers/listeners/disposers ────────

function _disposeElement(node) {
	const ctxId = node.__ctx?.__raw?.__devtoolsId;

	if (node.__ctx?.__listeners) {
		for (const set of node.__ctx.__listeners.values()) {
			for (const fn of set) {
				_storeWatchers.delete(fn);
				_i18nListeners.delete(fn);
			}
		}
		node.__ctx.__listeners.clear();
		node.__ctx.__listeners.set("*", new Set());
	}
	if (node.__disposers) {
		node.__disposers.forEach((fn) => {
			if (typeof fn === "function") fn();
		});
	}
	if (ctxId) {
		_ctxRegistry.delete(ctxId);
		_devtoolsEmit("ctx:disposed", {
			id: ctxId,
			elementTag: node.tagName?.toLowerCase(),
		});
	}
	node.__declared = false;
	node.__ctx = null;
	node.__disposers = null;
}

export function _disposeTree(root) {
	if (!root) return;
	_disposeElement(root);
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
	while (walker.nextNode()) _disposeElement(walker.currentNode);
}

export function _disposeChildren(parent) {
	if (!parent) return;
	const walker = document.createTreeWalker(parent, NodeFilter.SHOW_ELEMENT);
	while (walker.nextNode()) _disposeElement(walker.currentNode);
}

/**
 * Detach all children of `parent` into an off-DOM DocumentFragment before
 * running disposal. This prevents disposer callbacks (which may trigger DOM
 * reads/writes) from causing browser layout recalculations while the subtree
 * is still attached to the live document.
 *
 * After the call the parent is empty and all JS state (listeners, disposers,
 * context refs) on the former children has been released.
 *
 * Use instead of the `_disposeChildren(el); el.innerHTML = ""` pattern
 * wherever clearing a list is the primary goal (loops, http, conditionals).
 */
export function _disposeAndClear(parent) {
	if (!parent) return;
	// Detach all children in one batch — a single reflow instead of N.
	const frag = document.createDocumentFragment();
	while (parent.firstChild) frag.appendChild(parent.firstChild);
	// Walk and dispose the now off-DOM subtree.
	const walker = document.createTreeWalker(frag, NodeFilter.SHOW_ELEMENT);
	while (walker.nextNode()) _disposeElement(walker.currentNode);
	// frag goes out of scope → children are GC-eligible.
}
