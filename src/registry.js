// ═══════════════════════════════════════════════════════════════════════
//  DIRECTIVE REGISTRY & DOM PROCESSING
// ═══════════════════════════════════════════════════════════════════════

import { _currentEl, _setCurrentEl, _storeWatchers } from "./globals.js";
import { _i18nListeners } from "./i18n.js";

const _directives = new Map();

export function registerDirective(name, handler) {
  _directives.set(name, {
    priority: handler.priority ?? 50,
    init: handler.init,
  });
}

function _matchDirective(attrName) {
  if (_directives.has(attrName))
    return { directive: _directives.get(attrName), match: attrName };
  // Pattern matches
  const patterns = ["class-*", "on:*", "style-*", "bind-*"];
  for (const p of patterns) {
    const prefix = p.replace("*", "");
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
}

export function processTree(root) {
  if (!root) return;
  if (root.nodeType === 1 && !root.__declared) processElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.tagName === "TEMPLATE" || node.tagName === "SCRIPT") continue;
    if (!node.__declared) processElement(node);
  }
}

// ─── Disposal: proactive cleanup of watchers/listeners/disposers ────────

function _disposeElement(node) {
  if (node.__ctx && node.__ctx.__listeners) {
    for (const fn of node.__ctx.__listeners) {
      _storeWatchers.delete(fn);
      _i18nListeners.delete(fn);
    }
    node.__ctx.__listeners.clear();
  }
  if (node.__disposers) {
    node.__disposers.forEach((fn) => fn());
    node.__disposers = null;
  }
  node.__declared = false;
}

export function _disposeTree(root) {
  if (!root) return;
  _disposeElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) _disposeElement(walker.currentNode);
}
