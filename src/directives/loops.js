// ═══════════════════════════════════════════════════════════════════════
//  DIRECTIVES: each, foreach
// ═══════════════════════════════════════════════════════════════════════

import { createContext } from "../context.js";
import { _cloneTemplate, findContext } from "../dom.js";
import { evaluate, resolve } from "../evaluate.js";
import { _watchExpr } from "../globals.js";
import {
	_disposeAndClear,
	_disposeChildren,
	processTree,
	registerDirective,
} from "../registry.js";
import { getEngine } from "../wasm/loader.js";

registerDirective("each", {
	priority: 10,
	init(el, _name, expr) {
		const ctx = findContext(el);
		const match = expr.match(/^(\w+)\s+in\s+(\S+)$/);
		if (!match) return;
		const [, itemName, listPath] = match;
		const tplId =
			el.getAttribute("data-nojs-template") || el.getAttribute("template");
		const elseTpl = el.getAttribute("else");
		const keyExpr = el.getAttribute("key");
		const animEnter =
			el.getAttribute("animate-enter") || el.getAttribute("animate");
		const animLeave = el.getAttribute("animate-leave");
		const stagger = parseInt(el.getAttribute("animate-stagger"), 10) || 0;
		const animDuration = parseInt(el.getAttribute("animate-duration"), 10) || 0;
		let prevList = null;

		// key → wrapper div; only populated when the `key` attribute is set.
		const keyMap = new Map();

		const isVirtual = el.hasAttribute("virtual");
		const itemHeight = parseInt(el.getAttribute("virtual-height"), 10) || 40;
		const buffer = 5; // extra items to render above/below viewport

		// Internal state for virtualization
		let virtualScrollTop = 0;
		let virtualViewportHeight = 0;
		let virtualObserver = null;

		function setupVirtual() {
			if (!isVirtual || virtualObserver) return;

			el.style.position = "relative";
			el.style.overflowY = "auto";
			el.style.minHeight = "100px"; // Default if not set

			virtualObserver = new IntersectionObserver((entries) => {
				if (entries[0].isIntersecting) {
					virtualViewportHeight = el.clientHeight;
					renderVirtual();
				}
			});
			virtualObserver.observe(el);

			el.addEventListener("scroll", () => {
				virtualScrollTop = el.scrollTop;
				renderVirtual();
			}, { passive: true });
		}

		function renderVirtual() {
			if (!prevList) return;
			const list = prevList;
			const total = list.length;
			const startIndex = Math.max(0, Math.floor(virtualScrollTop / itemHeight) - buffer);
			const endIndex = Math.min(total, Math.ceil((virtualScrollTop + virtualViewportHeight) / itemHeight) + buffer);

			const visibleList = list.slice(startIndex, endIndex);
			
			// Adjust el style to show full height
			const totalHeight = total * itemHeight;
			// We use a padding-based spacer strategy
			el.style.paddingTop = `${startIndex * itemHeight}px`;
			el.style.paddingBottom = `${(total - endIndex) * itemHeight}px`;

			// Render visible slice
			const tpl = tplId ? document.getElementById(tplId) : null;
			if (!tpl) return;

			// Virtual lists ALWAYS use key-based reconciliation for performance
			// We create a temporary sub-list for reconciliation
			const visibleOrder = visibleList.map((item, i) => {
				const realIndex = startIndex + i;
				const tempCtx = createContext({ [itemName]: item, $index: realIndex }, ctx);
				const key = keyExpr ? String(evaluate(keyExpr, tempCtx)) : `v-${realIndex}`;
				return { key, item, i: realIndex };
			});

			// Standard reconciliation but only for visible nodes
			const nextKeySet = new Set(visibleOrder.map(e => e.key));
			for (const [key, wrapper] of keyMap) {
				if (!nextKeySet.has(key)) {
					_disposeChildren(wrapper);
					wrapper.remove();
					keyMap.delete(key);
				}
			}

			visibleOrder.forEach(({ key, item, i }) => {
				const childData = {
					[itemName]: item,
					$index: i,
					$count: total,
					$first: i === 0,
					$last: i === total - 1,
					$even: i % 2 === 0,
					$odd: i % 2 !== 0,
				};

				if (!keyMap.has(key)) {
					const clone = tpl.content.cloneNode(true);
					const wrapper = document.createElement("div");
					wrapper.style.display = "contents";
					wrapper.__ctx = createContext(childData, ctx);
					wrapper.appendChild(clone);
					keyMap.set(key, wrapper);
					el.appendChild(wrapper);
					processTree(wrapper);
				} else {
					Object.assign(keyMap.get(key).__ctx.__raw, childData);
					keyMap.get(key).__ctx.$notify();
				}
			});

			// Reorder visible items
			for (let i = 0; i < visibleOrder.length; i++) {
				const wrapper = keyMap.get(visibleOrder[i].key);
				if (wrapper !== el.children[i]) {
					el.insertBefore(wrapper, el.children[i] ?? null);
				}
			}
		}

		function update() {
			const list = /[[\]()\s+\-*/!?:&|]/.test(listPath)
				? evaluate(listPath, ctx)
				: resolve(listPath, ctx);
			if (!Array.isArray(list)) return;

			prevList = list;

			if (isVirtual) {
				setupVirtual();
				renderVirtual();
				return;
			}

			// Empty state
			if (list.length === 0 && elseTpl) {
				const clone = _cloneTemplate(elseTpl);
				if (clone) {
					_disposeAndClear(el);
					keyMap.clear();
					el.appendChild(clone);
					processTree(el);
				}
				return;
			}

			const tpl = tplId ? document.getElementById(tplId) : null;
			if (!tpl) return;

			// Animate out old items if animate-leave is set
			if (animLeave && el.children.length > 0) {
				const oldItems = [...el.children];
				let remaining = oldItems.length;
				oldItems.forEach((child) => {
					const target = child.firstElementChild || child;
					target.classList.add(animLeave);
					const done = () => {
						target.classList.remove(animLeave);
						remaining--;
						if (remaining <= 0) renderItems(tpl, list);
					};
					target.addEventListener("animationend", done, { once: true });
					// || 0: unblocks the next render on the next tick when no CSS animation fires.
					setTimeout(done, animDuration || 0);
				});
			} else {
				renderItems(tpl, list);
			}
		}

		function renderItems(tpl, list) {
			if (keyExpr) {
				reconcileItems(tpl, list);
			} else {
				rebuildItems(tpl, list);
			}
		}

		// Key-based reconciliation: reuses existing wrapper divs for items whose
		// key is still present in the new list, only creating/removing DOM nodes
		// for items that genuinely appeared or disappeared.
		function reconcileItems(tpl, list) {
			const count = list.length;

			// Evaluate the key for every item in the new list up-front.
			const newOrder = list.map((item, i) => {
				const tempCtx = createContext({ [itemName]: item, $index: i }, ctx);
				return { key: String(evaluate(keyExpr, tempCtx)), item, i };
			});

			const nextKeySet = new Set(newOrder.map((e) => e.key));
			const oldKeys = Array.from(keyMap.keys());
			const newKeys = newOrder.map((e) => e.key);

			const engine = getEngine();
			if (engine?.diff_keyed_list) {
				try {
					const patches = engine.diff_keyed_list(oldKeys, newKeys);
					// Process patches from Rust
					for (const patch of patches) {
						if (patch.Remove) {
							const wrapper = keyMap.get(patch.Remove.key);
							if (wrapper) {
								_disposeChildren(wrapper);
								wrapper.remove();
								keyMap.delete(patch.Remove.key);
							}
						}
					}
					// (Inserts and Moves are handled by the reorder loop below for simplicity in this MVP)
				} catch (_e) {
					// Fallback to JS diff
				}
			}

			// Original fallback/cleanup for removals not handled by WASM
			for (const [key, wrapper] of keyMap) {
				if (!nextKeySet.has(key)) {
					_disposeChildren(wrapper);
					wrapper.remove();
					keyMap.delete(key);
				}
			}

			// Create new wrappers and update existing ones.
			// Collect genuinely new wrappers in a fragment; insert in one batch.
			const newFrag = document.createDocumentFragment();
			const newWrappers = [];

			newOrder.forEach(({ key, item, i }) => {
				const childData = {
					[itemName]: item,
					$index: i,
					$count: count,
					$first: i === 0,
					$last: i === count - 1,
					$even: i % 2 === 0,
					$odd: i % 2 !== 0,
				};

				if (!keyMap.has(key)) {
					const clone = tpl.content.cloneNode(true);
					const wrapper = document.createElement("div");
					wrapper.style.display = "contents";
					wrapper.__ctx = createContext(childData, ctx);
					wrapper.appendChild(clone);
					keyMap.set(key, wrapper);
					newFrag.appendChild(wrapper); // batch — not yet in live DOM
					newWrappers.push({ wrapper, i });
				} else {
					// Existing item: update positional metadata and notify watchers.
					Object.assign(keyMap.get(key).__ctx.__raw, childData);
					keyMap.get(key).__ctx.$notify();
				}
			});

			// Insert all new wrappers in a single DOM operation, then process.
			if (newWrappers.length > 0) {
				el.appendChild(newFrag); // placed at end; reordered below
				newWrappers.forEach(({ wrapper, i }) => {
					processTree(wrapper);
					if (animEnter) {
						const firstChild = wrapper.firstElementChild;
						if (firstChild) {
							firstChild.classList.add(animEnter);
							firstChild.addEventListener(
								"animationend",
								() => firstChild.classList.remove(animEnter),
								{ once: true },
							);
							if (stagger) firstChild.style.animationDelay = `${i * stagger}ms`;
						}
					}
				});
			}

			// Reorder DOM to match the new list using a single forward pass.
			for (let i = 0; i < newOrder.length; i++) {
				const wrapper = keyMap.get(newOrder[i].key);
				if (wrapper !== el.children[i])
					el.insertBefore(wrapper, el.children[i] ?? null);
			}
		}

		// Full rebuild: dispose all children and recreate from scratch.
		// Used when no `key` attribute is set (backward-compatible behaviour).
		function rebuildItems(tpl, list) {
			const count = list.length;
			_disposeAndClear(el);

			// Batch all new wrappers into a DocumentFragment before inserting into
			// the live DOM. A single el.appendChild(frag) replaces N individual
			// appends, reducing layout/style recalculations to one pass.
			const frag = document.createDocumentFragment();
			const wrappers = [];

			list.forEach((item, i) => {
				const childData = {
					[itemName]: item,
					$index: i,
					$count: count,
					$first: i === 0,
					$last: i === count - 1,
					$even: i % 2 === 0,
					$odd: i % 2 !== 0,
				};
				const childCtx = createContext(childData, ctx);

				const clone = tpl.content.cloneNode(true);
				const wrapper = document.createElement("div");
				wrapper.style.display = "contents";
				wrapper.__ctx = childCtx;
				wrapper.appendChild(clone);
				frag.appendChild(wrapper);
				wrappers.push(wrapper);
			});

			el.appendChild(frag); // single DOM mutation

			wrappers.forEach((wrapper, i) => {
				processTree(wrapper);

				if (animEnter) {
					const firstChild = wrapper.firstElementChild;
					if (firstChild) {
						firstChild.classList.add(animEnter);
						firstChild.addEventListener(
							"animationend",
							() => firstChild.classList.remove(animEnter),
							{ once: true },
						);
						if (stagger) {
							firstChild.style.animationDelay = `${i * stagger}ms`;
						}
					}
				}
			});
		}

		_watchExpr(expr, ctx, update);
		update();
	},
});

registerDirective("foreach", {
	priority: 10,
	init(el, _name, itemName) {
		const ctx = findContext(el);
		const fromPath = el.getAttribute("from");
		const indexName = el.getAttribute("index") || "$index";
		const elseTpl = el.getAttribute("else");
		const filterExpr = el.getAttribute("filter");
		const sortProp = el.getAttribute("sort");
		const limit = parseInt(el.getAttribute("limit"), 10) || Infinity;
		const offset = parseInt(el.getAttribute("offset"), 10) || 0;
		const tplId =
			el.getAttribute("data-nojs-template") || el.getAttribute("template");
		const keyExpr = el.getAttribute("key");
		const animEnter =
			el.getAttribute("animate-enter") || el.getAttribute("animate");
		const animLeave = el.getAttribute("animate-leave");
		const stagger = parseInt(el.getAttribute("animate-stagger"), 10) || 0;
		const animDuration = parseInt(el.getAttribute("animate-duration"), 10) || 0;

		if (!fromPath || !itemName) return;

		const templateContent = tplId
			? null // Will use external template
			: el.cloneNode(true); // Use the element itself as template

		// Prevent infinite recursion: strip directive attributes from inline template clone
		if (templateContent) {
			templateContent.removeAttribute("foreach");
			templateContent.removeAttribute("from");
			templateContent.removeAttribute("index");
			templateContent.removeAttribute("filter");
			templateContent.removeAttribute("sort");
			templateContent.removeAttribute("limit");
			templateContent.removeAttribute("offset");
			templateContent.removeAttribute("else");
			templateContent.removeAttribute("template");
			templateContent.removeAttribute("key");
			templateContent.removeAttribute("animate-enter");
			templateContent.removeAttribute("animate");
			templateContent.removeAttribute("animate-leave");
			templateContent.removeAttribute("animate-stagger");
			templateContent.removeAttribute("animate-duration");
		}

		const isVirtual = el.hasAttribute("virtual");
		const itemHeight = parseInt(el.getAttribute("virtual-height"), 10) || 40;
		const buffer = 5;

		// Internal state for virtualization
		let virtualScrollTop = 0;
		let virtualViewportHeight = 0;
		let virtualObserver = null;
		let lastList = null;

		function setupForeachVirtual() {
			if (!isVirtual || virtualObserver) return;
			el.style.position = "relative";
			el.style.overflowY = "auto";
			el.style.minHeight = "100px";

			virtualObserver = new IntersectionObserver((entries) => {
				if (entries[0].isIntersecting) {
					virtualViewportHeight = el.clientHeight;
					renderForeachVirtual();
				}
			});
			virtualObserver.observe(el);

			el.addEventListener("scroll", () => {
				virtualScrollTop = el.scrollTop;
				renderForeachVirtual();
			}, { passive: true });
		}

		function renderForeachVirtual() {
			if (!lastList) return;
			const list = lastList;
			const total = list.length;
			const startIndex = Math.max(0, Math.floor(virtualScrollTop / itemHeight) - buffer);
			const endIndex = Math.min(total, Math.ceil((virtualScrollTop + virtualViewportHeight) / itemHeight) + buffer);

			const visibleList = list.slice(startIndex, endIndex);
			el.style.paddingTop = `${startIndex * itemHeight}px`;
			el.style.paddingBottom = `${(total - endIndex) * itemHeight}px`;

			const tpl = tplId ? document.getElementById(tplId) : null;
			const visibleOrder = visibleList.map((item, i) => {
				const realIndex = startIndex + i;
				const tempCtx = createContext({ [itemName]: item, [indexName]: realIndex }, ctx);
				const key = keyExpr ? String(evaluate(keyExpr, tempCtx)) : `v-${realIndex}`;
				return { key, item, i: realIndex };
			});

			const nextKeySet = new Set(visibleOrder.map(e => e.key));
			for (const [key, wrapper] of keyMap) {
				if (!nextKeySet.has(key)) {
					_disposeChildren(wrapper);
					wrapper.remove();
					keyMap.delete(key);
				}
			}

			visibleOrder.forEach(({ key, item, i }) => {
				const childData = {
					[itemName]: item,
					[indexName]: i,
					$index: i,
					$count: total,
					$first: i === 0,
					$last: i === total - 1,
					$even: i % 2 === 0,
					$odd: i % 2 !== 0,
				};

				if (!keyMap.has(key)) {
					let clone;
					if (tpl) {
						clone = tpl.content.cloneNode(true);
					} else {
						clone = templateContent.cloneNode(true);
					}
					const wrapper = document.createElement("div");
					wrapper.style.display = "contents";
					wrapper.__ctx = createContext(childData, ctx);
					wrapper.appendChild(clone);
					keyMap.set(key, wrapper);
					el.appendChild(wrapper);
					processTree(wrapper);
				} else {
					Object.assign(keyMap.get(key).__ctx.__raw, childData);
					keyMap.get(key).__ctx.$notify();
				}
			});

			for (let i = 0; i < visibleOrder.length; i++) {
				const wrapper = keyMap.get(visibleOrder[i].key);
				if (wrapper !== el.children[i]) {
					el.insertBefore(wrapper, el.children[i] ?? null);
				}
			}
		}

		function update() {
			let list = resolve(fromPath, ctx);
			if (!Array.isArray(list)) return;

			// Filter
			if (filterExpr) {
				list = list.filter((item, i) => {
					const tempCtx = createContext(
						{ [itemName]: item, [indexName]: i },
						ctx,
					);
					return !!evaluate(filterExpr, tempCtx);
				});
			}

			// Sort
			if (sortProp) {
				const desc = sortProp.startsWith("-");
				const key = desc ? sortProp.slice(1) : sortProp;
				list = [...list].sort((a, b) => {
					const va = resolve(key, a) ?? a?.[key];
					const vb = resolve(key, b) ?? b?.[key];
					const r = va < vb ? -1 : va > vb ? 1 : 0;
					return desc ? -r : r;
				});
			}

			// Offset and limit
			list = list.slice(offset, offset + limit);
			lastList = list;

			if (isVirtual) {
				setupForeachVirtual();
				renderForeachVirtual();
				return;
			}

			// Empty
			if (list.length === 0 && elseTpl) {
				const clone = _cloneTemplate(elseTpl);
				if (clone) {
					_disposeAndClear(el);
					keyMap.clear();
					el.appendChild(clone);
					processTree(el);
				}
				return;
			}

			const tpl = tplId ? document.getElementById(tplId) : null;
			const count = list.length;

			if (keyExpr) {
				reconcileForeachItems(tpl, list, count);
				return;
			}

			function renderForeachItems() {
				_disposeAndClear(el);

				const frag = document.createDocumentFragment();
				const wrappers = [];
				list.forEach((item, i) => {
					const childData = {
						[itemName]: item,
						[indexName]: i,
						$index: i,
						$count: count,
						$first: i === 0,
						$last: i === count - 1,
						$even: i % 2 === 0,
						$odd: i % 2 !== 0,
					};
					const childCtx = createContext(childData, ctx);

					let clone;
					if (tpl) {
						clone = tpl.content.cloneNode(true);
					} else {
						clone = templateContent.cloneNode(true);
						// Prevent infinite recursion: the clone should not have the foreach directive itself
						if (clone.nodeType === 1) {
							clone.removeAttribute("foreach");
							clone.removeAttribute("from");
						}
					}

					const wrapper = document.createElement("div");
					wrapper.style.display = "contents";
					wrapper.__ctx = childCtx;
					wrapper.appendChild(clone);
					frag.appendChild(wrapper);
					wrappers.push(wrapper);
				});

				el.appendChild(frag); // single DOM mutation

				wrappers.forEach((wrapper, i) => {
					processTree(wrapper);

					if (animEnter) {
						const firstChild = wrapper.firstElementChild;
						if (firstChild) {
							firstChild.classList.add(animEnter);
							firstChild.addEventListener(
								"animationend",
								() => firstChild.classList.remove(animEnter),
								{ once: true },
							);
							if (stagger) {
								firstChild.style.animationDelay = `${i * stagger}ms`;
							}
						}
					}
				});
			}

			// Animate out old items if animate-leave is set
			if (animLeave && el.children.length > 0) {
				const oldItems = [...el.children];
				let remaining = oldItems.length;
				oldItems.forEach((child) => {
					const target = child.firstElementChild || child;
					target.classList.add(animLeave);
					const done = () => {
						target.classList.remove(animLeave);
						remaining--;
						if (remaining <= 0) renderForeachItems();
					};
					target.addEventListener("animationend", done, { once: true });
					// || 0: unblocks the next render on the next tick when no CSS animation fires.
					setTimeout(done, animDuration || 0);
				});
			} else {
				renderForeachItems();
			}
		}

		// Key-based reconciliation for foreach — mirrors each's reconcileItems.
		// Applied to the final (filtered, sorted, sliced) list so keys always
		// correspond to what is actually rendered.
		function reconcileForeachItems(tpl, list, count) {
			// On first render the element may still hold its original inline template
			// markup (the same content that was captured into templateContent).
			// Clear it so only managed wrappers appear as children.
			if (keyMap.size === 0) el.innerHTML = "";

			const newOrder = list.map((item, i) => {
				const tempCtx = createContext(
					{ [itemName]: item, [indexName]: i },
					ctx,
				);
				return { key: evaluate(keyExpr, tempCtx), item, i };
			});

			const nextKeySet = new Set(newOrder.map((e) => e.key));

			for (const [key, wrapper] of keyMap) {
				if (!nextKeySet.has(key)) {
					_disposeChildren(wrapper);
					wrapper.remove();
					keyMap.delete(key);
				}
			}

			const foreachNewFrag = document.createDocumentFragment();
			const foreachNewWrappers = [];

			newOrder.forEach(({ key, item, i }) => {
				const childData = {
					[itemName]: item,
					[indexName]: i,
					$index: i,
					$count: count,
					$first: i === 0,
					$last: i === count - 1,
					$even: i % 2 === 0,
					$odd: i % 2 !== 0,
				};

				if (!keyMap.has(key)) {
					let clone;
					if (tpl) {
						clone = tpl.content.cloneNode(true);
					} else {
						clone = templateContent.cloneNode(true);
					}
					const wrapper = document.createElement("div");
					wrapper.style.display = "contents";
					wrapper.__ctx = createContext(childData, ctx);
					wrapper.appendChild(clone);
					keyMap.set(key, wrapper);
					foreachNewFrag.appendChild(wrapper); // batch — not yet in live DOM
					foreachNewWrappers.push({ wrapper, i });
				} else {
					Object.assign(keyMap.get(key).__ctx.__raw, childData);
					keyMap.get(key).__ctx.$notify();
				}
			});

			if (foreachNewWrappers.length > 0) {
				el.appendChild(foreachNewFrag); // single DOM mutation
				foreachNewWrappers.forEach(({ wrapper, i }) => {
					processTree(wrapper);
					if (animEnter) {
						const firstChild = wrapper.firstElementChild;
						if (firstChild) {
							firstChild.classList.add(animEnter);
							firstChild.addEventListener(
								"animationend",
								() => firstChild.classList.remove(animEnter),
								{ once: true },
							);
							if (stagger) firstChild.style.animationDelay = `${i * stagger}ms`;
						}
					}
				});
			}

			for (let i = 0; i < newOrder.length; i++) {
				const wrapper = keyMap.get(newOrder[i].key);
				if (wrapper !== el.children[i])
					el.insertBefore(wrapper, el.children[i] ?? null);
			}
		}

		_watchExpr(fromPath, ctx, update);
		update();
	},
});
