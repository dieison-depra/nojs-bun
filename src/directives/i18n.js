// ═══════════════════════════════════════════════════════════════════════
//  DIRECTIVE: t (i18n translations)
//  DIRECTIVE: i18n-ns (load namespace before children)
// ═══════════════════════════════════════════════════════════════════════

import { findContext } from "../dom.js";
import { evaluate } from "../evaluate.js";
import { _watchExpr } from "../globals.js";
import { _i18n, _loadI18nNamespace, _notifyI18n, _watchI18n } from "../i18n.js";
import { processTree, registerDirective } from "../registry.js";

registerDirective("t", {
	priority: 20,
	init(el, _name, key) {
		const ctx = findContext(el);
		const useHtml = el.hasAttribute("t-html");

		function update() {
			const params = {};
			for (const attr of [...el.attributes]) {
				if (
					attr.name.startsWith("t-") &&
					attr.name !== "t" &&
					attr.name !== "t-html"
				) {
					const paramName = attr.name.replace("t-", "");
					params[paramName] = evaluate(attr.value, ctx) ?? attr.value;
				}
			}
			const text = _i18n.t(key, params);
			if (useHtml) {
				el.innerHTML = text;
			} else {
				el.textContent = text;
			}
		}

		_watchExpr(key, ctx, update);
		_watchI18n(update);
		update();
	},
});

registerDirective("i18n-ns", {
	priority: 1,
	init(el, _name, ns) {
		// Empty ns = marker attribute (e.g. route-view); skip loading
		if (!ns) return;

		// Save children to prevent premature t resolution
		const saved = document.createDocumentFragment();
		while (el.firstChild) saved.appendChild(el.firstChild);

		_loadI18nNamespace(ns).then(() => {
			el.appendChild(saved);
			processTree(el);
			_notifyI18n();
		});
	},
});
