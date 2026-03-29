// ═══════════════════════════════════════════════════════════════════════
//  EXPRESSION EVALUATOR (JIT COMPILER)
// ═══════════════════════════════════════════════════════════════════════

import { _collectKeys } from "./context.js";
import {
	_config,
	_filters,
	_globals,
	_notifyStoreWatchers,
	_routerInstance,
	_stores,
	_warn,
} from "./globals.js";
import { _i18n } from "./i18n.js";
import { getEngine } from "./wasm/loader.js";

function _makeCache() {
	const map = new Map();
	return {
		get(k) {
			if (!map.has(k)) return undefined;
			const v = map.get(k);
			map.delete(k);
			map.set(k, v);
			return v;
		},
		has(k) {
			return map.has(k);
		},
		set(k, v) {
			const max = _config.exprCacheSize;
			if (map.has(k)) {
				map.delete(k);
			} else if (map.size >= max) {
				map.delete(map.keys().next().value);
			}
			map.set(k, v);
		},
		get size() {
			return map.size;
		},
	};
}
export const _exprCache = _makeCache();
export const _stmtCache = _makeCache();

// ── Tokenizer ──────────────────────────────────────────────────────────

const _KEYWORDS = new Set([
	"true",
	"false",
	"null",
	"undefined",
	"typeof",
	"in",
	"instanceof",
]);
const _FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

const _MULTI = [
	"===",
	"!==",
	"...",
	"??",
	"?.",
	"==",
	"!=",
	">=",
	"<=",
	"&&",
	"||",
	"+=",
	"-=",
	"*=",
	"/=",
	"%=",
	"++",
	"--",
	"=>",
];
const _SINGLE_OPS = new Set(["+", "-", "*", "/", "%", ">", "<", "!", "=", "|"]);
const _SINGLE_PUNC = new Set([
	"(",
	")",
	"[",
	"]",
	"{",
	"}",
	".",
	",",
	":",
	";",
	"?",
]);

function _tokenize(expr) {
	if (typeof expr !== "string") return [];

	const engine = getEngine();
	if (engine?.tokenize_expression) {
		try {
			return engine.tokenize_expression(expr);
		} catch (_e) {
			// Fallback to JS tokenizer
		}
	}

	const tokens = [];
	const len = expr.length;
	let pos = 0;

	while (pos < len) {
		const ch = expr[pos];
		if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
			pos++;
			continue;
		}
		if (ch === "'" || ch === '"') {
			const start = pos;
			const quote = ch;
			pos++;
			let value = "";
			while (pos < len && expr[pos] !== quote) {
				if (expr[pos] === "\\") {
					pos++;
					if (pos < len) {
						const esc = expr[pos];
						if (esc === "n") value += "\n";
						else if (esc === "t") value += "\t";
						else if (esc === "r") value += "\r";
						else value += esc;
						pos++;
					}
				} else value += expr[pos++];
			}
			if (pos < len) pos++;
			tokens.push({ type: "String", value, pos: start });
			continue;
		}
		if (ch === "`") {
			const start = pos;
			pos++;
			const parts = [];
			const exprs = [];
			let seg = "";
			while (pos < len && expr[pos] !== "`") {
				if (expr[pos] === "\\" && pos + 1 < len) {
					const esc = expr[pos + 1];
					if (esc === "n") seg += "\n";
					else if (esc === "t") seg += "\t";
					else if (esc === "r") seg += "\r";
					else seg += esc;
					pos += 2;
				} else if (
					expr[pos] === "$" &&
					pos + 1 < len &&
					expr[pos + 1] === "{"
				) {
					parts.push(seg);
					seg = "";
					pos += 2;
					let depth = 1;
					let inner = "";
					while (pos < len && depth > 0) {
						if (expr[pos] === "{") depth++;
						else if (expr[pos] === "}") {
							depth--;
							if (depth === 0) break;
						} else if (
							expr[pos] === "'" ||
							expr[pos] === '"' ||
							expr[pos] === "`"
						) {
							const q = expr[pos];
							inner += q;
							pos++;
							while (pos < len && expr[pos] !== q) {
								if (expr[pos] === "\\") {
									inner += expr[pos++];
									if (pos < len) inner += expr[pos++];
								} else inner += expr[pos++];
							}
							if (pos < len) {
								inner += expr[pos];
								pos++;
							}
							continue;
						}
						inner += expr[pos++];
					}
					if (pos < len) pos++;
					exprs.push(_tokenize(inner));
				} else seg += expr[pos++];
			}
			if (pos < len) pos++;
			parts.push(seg);
			tokens.push({ type: "Template", parts, exprs, pos: start });
			continue;
		}
		if (
			(ch >= "0" && ch <= "9") ||
			(ch === "." &&
				pos + 1 < len &&
				expr[pos + 1] >= "0" &&
				expr[pos + 1] <= "9")
		) {
			const start = pos;
			let num = "";
			while (
				pos < len &&
				((expr[pos] >= "0" && expr[pos] <= "9") || expr[pos] === ".")
			) {
				num += expr[pos++];
			}
			tokens.push({ type: "Number", value: num, pos: start });
			continue;
		}
		if (
			(ch >= "a" && ch <= "z") ||
			(ch >= "A" && ch <= "Z") ||
			ch === "_" ||
			ch === "$"
		) {
			const start = pos;
			let id = "";
			while (pos < len) {
				const c = expr[pos];
				if (
					(c >= "a" && c <= "z") ||
					(c >= "A" && c <= "Z") ||
					(c >= "0" && c <= "9") ||
					c === "_" ||
					c === "$"
				) {
					id += c;
					pos++;
				} else break;
			}
			if (_FORBIDDEN.has(id))
				tokens.push({ type: "Forbidden", value: id, pos: start });
			else if (_KEYWORDS.has(id))
				tokens.push({ type: "Keyword", value: id, pos: start });
			else tokens.push({ type: "Ident", value: id, pos: start });
			continue;
		}
		let matched = false;
		for (let m = 0; m < _MULTI.length; m++) {
			const op = _MULTI[m];
			if (expr.startsWith(op, pos)) {
				const isPunc = op === "..." || op === "?.";
				tokens.push({ type: isPunc ? "Punc" : "Op", value: op, pos });
				pos += op.length;
				matched = true;
				break;
			}
		}
		if (matched) continue;
		if (_SINGLE_OPS.has(ch)) {
			tokens.push({ type: "Op", value: ch, pos });
			pos++;
			continue;
		}
		if (_SINGLE_PUNC.has(ch)) {
			tokens.push({ type: "Punc", value: ch, pos });
			pos++;
			continue;
		}
		pos++;
	}
	return tokens;
}

// ── Parser ─────────────────────────────────────────────────────────────

function _parseExpr(tokens) {
	if (!tokens || tokens.length === 0)
		return { type: "Literal", value: undefined };
	let pos = 0;
	function peek() {
		return tokens[pos];
	}
	function next() {
		return tokens[pos++];
	}
	function match(type, value) {
		const t = tokens[pos];
		if (!t) return false;
		if (value !== undefined) return t.type === type && t.value === value;
		return t.type === type;
	}
	function expect(type, value) {
		const t = tokens[pos];
		if (t && t.type === type && (value === undefined || t.value === value)) {
			pos++;
			return t;
		}
		return null;
	}

	function parseExpression() {
		return parseTernary();
	}
	function parseTernary() {
		let node = parseNullishOr();
		if (match("Punc", "?")) {
			next();
			const consequent = parseTernary();
			expect("Punc", ":");
			const alternate = parseTernary();
			node = { type: "ConditionalExpr", test: node, consequent, alternate };
		}
		return node;
	}
	function parseNullishOr() {
		let node = parseLogicalOr();
		if (match("Op", "??")) {
			next();
			const right = parseNullishOr();
			node = { type: "BinaryExpr", op: "??", left: node, right };
		}
		return node;
	}
	function parseLogicalOr() {
		let node = parseLogicalAnd();
		while (match("Op", "||")) {
			next();
			const right = parseLogicalAnd();
			node = { type: "BinaryExpr", op: "||", left: node, right };
		}
		return node;
	}
	function parseLogicalAnd() {
		let node = parseBitwiseOr();
		while (match("Op", "&&")) {
			next();
			const right = parseBitwiseOr();
			node = { type: "BinaryExpr", op: "&&", left: node, right };
		}
		return node;
	}
	function parseBitwiseOr() {
		let node = parseComparison();
		while (
			peek() &&
			peek().type === "Op" &&
			peek().value === "|" &&
			(!tokens[pos + 1] || tokens[pos + 1].value !== "|")
		) {
			next();
			const right = parseComparison();
			node = { type: "BinaryExpr", op: "|", left: node, right };
		}
		return node;
	}
	function parseComparison() {
		let node = parseAddition();
		const t = peek();
		if (!t) return node;
		const compOps = ["===", "!==", "==", "!=", ">=", "<=", ">", "<"];
		if (
			(t.type === "Op" && compOps.indexOf(t.value) !== -1) ||
			(t.type === "Keyword" && (t.value === "in" || t.value === "instanceof"))
		) {
			const op = next().value;
			const right = parseAddition();
			node = { type: "BinaryExpr", op, left: node, right };
		}
		return node;
	}
	function parseAddition() {
		let node = parseMultiplication();
		while (
			peek() &&
			peek().type === "Op" &&
			(peek().value === "+" || peek().value === "-")
		) {
			const op = next().value;
			const right = parseMultiplication();
			node = { type: "BinaryExpr", op, left: node, right };
		}
		return node;
	}
	function parseMultiplication() {
		let node = parseUnary();
		while (
			peek() &&
			peek().type === "Op" &&
			(peek().value === "*" || peek().value === "/" || peek().value === "%")
		) {
			const op = next().value;
			const right = parseUnary();
			node = { type: "BinaryExpr", op, left: node, right };
		}
		return node;
	}
	function parseUnary() {
		const t = peek();
		if (!t) return { type: "Literal", value: undefined };
		if (t.type === "Keyword" && t.value === "typeof") {
			next();
			return { type: "UnaryExpr", op: "typeof", argument: parseUnary() };
		}
		if (
			t.type === "Op" &&
			(t.value === "!" || t.value === "-" || t.value === "+")
		) {
			next();
			return { type: "UnaryExpr", op: t.value, argument: parseUnary() };
		}
		if (t.type === "Op" && (t.value === "++" || t.value === "--")) {
			next();
			return {
				type: "UnaryExpr",
				op: t.value,
				argument: parseUnary(),
				prefix: true,
			};
		}
		return parsePostfix();
	}
	function parsePostfix() {
		let node = parseCallMember();
		const t = peek();
		if (t && t.type === "Op" && (t.value === "++" || t.value === "--")) {
			next();
			node = { type: "PostfixExpr", op: t.value, argument: node };
		}
		return node;
	}
	function parseCallMember() {
		let node = parsePrimary();
		while (true) {
			const t = peek();
			if (!t) break;
			if (t.type === "Punc" && t.value === ".") {
				next();
				const prop = peek();
				if (prop && (prop.type === "Ident" || prop.type === "Keyword")) {
					next();
					node = {
						type: "MemberExpr",
						object: node,
						property: { type: "Identifier", name: prop.value },
						computed: false,
					};
				} else if (prop && prop.type === "Forbidden") {
					next();
					node = { type: "Forbidden" };
				} else break;
				continue;
			}
			if (t.type === "Punc" && t.value === "?.") {
				next();
				const nt = peek();
				if (nt && nt.type === "Punc" && nt.value === "(") {
					next();
					const args = parseArgsList();
					expect("Punc", ")");
					node = { type: "OptionalCallExpr", callee: node, args };
				} else if (nt && (nt.type === "Ident" || nt.type === "Keyword")) {
					next();
					node = {
						type: "OptionalMemberExpr",
						object: node,
						property: { type: "Identifier", name: nt.value },
						computed: false,
					};
				} else if (nt && nt.type === "Punc" && nt.value === "[") {
					next();
					const prop = parseExpression();
					expect("Punc", "]");
					node = {
						type: "OptionalMemberExpr",
						object: node,
						property: prop,
						computed: true,
					};
				} else break;
				continue;
			}
			if (t.type === "Punc" && t.value === "[") {
				next();
				const prop = parseExpression();
				expect("Punc", "]");
				node = {
					type: "MemberExpr",
					object: node,
					property: prop,
					computed: true,
				};
				continue;
			}
			if (t.type === "Punc" && t.value === "(") {
				next();
				const args = parseArgsList();
				expect("Punc", ")");
				node = { type: "CallExpr", callee: node, args };
				continue;
			}
			break;
		}
		return node;
	}
	function parseArgsList() {
		const args = [];
		if (match("Punc", ")")) return args;
		args.push(parseSpreadOrExpr());
		while (match("Punc", ",")) {
			next();
			if (match("Punc", ")")) break;
			args.push(parseSpreadOrExpr());
		}
		return args;
	}
	function parseSpreadOrExpr() {
		if (match("Punc", "...")) {
			next();
			return { type: "SpreadElement", argument: parseExpression() };
		}
		return parseExpression();
	}
	function isArrowParams() {
		const saved = pos;
		if (match("Punc", ")")) {
			const after = tokens[pos + 1];
			if (after && after.type === "Op" && after.value === "=>") {
				pos = saved;
				return true;
			}
			pos = saved;
			return false;
		}
		while (pos < tokens.length) {
			const t = peek();
			if (!t) break;
			if (t.type === "Ident") {
				next();
				if (match("Punc", ",")) {
					next();
					continue;
				}
				if (match("Punc", ")")) {
					const after = tokens[pos + 1];
					if (after && after.type === "Op" && after.value === "=>") {
						pos = saved;
						return true;
					}
					pos = saved;
					return false;
				}
				pos = saved;
				return false;
			}
			if (t.type === "Punc" && t.value === "...") {
				next();
				if (match("Ident")) next();
				if (match("Punc", ")")) {
					const after = tokens[pos + 1];
					if (after && after.type === "Op" && after.value === "=>") {
						pos = saved;
						return true;
					}
				}
				pos = saved;
				return false;
			}
			pos = saved;
			return false;
		}
		pos = saved;
		return false;
	}
	function parseArrowParams() {
		const params = [];
		if (match("Punc", ")")) return params;
		if (match("Punc", "...")) {
			next();
			if (match("Ident")) params.push(`...${next().value}`);
		} else if (match("Ident")) params.push(next().value);
		while (match("Punc", ",")) {
			next();
			if (match("Punc", ")")) break;
			if (match("Punc", "...")) {
				next();
				if (match("Ident")) params.push(`...${next().value}`);
			} else if (match("Ident")) params.push(next().value);
		}
		return params;
	}
	function parsePrimary() {
		const t = peek();
		if (!t) return { type: "Literal", value: undefined };
		if (t.type === "Forbidden") {
			next();
			return { type: "Forbidden" };
		}
		if (t.type === "Number") {
			next();
			return { type: "Literal", value: Number(t.value) };
		}
		if (t.type === "String") {
			next();
			return { type: "Literal", value: t.value };
		}
		if (t.type === "Template") {
			next();
			return {
				type: "TemplateLiteral",
				parts: t.parts,
				expressions: t.exprs.map((e) => _parseExpr(e)),
			};
		}
		if (t.type === "Keyword") {
			if (t.value === "true") {
				next();
				return { type: "Literal", value: true };
			}
			if (t.value === "false") {
				next();
				return { type: "Literal", value: false };
			}
			if (t.value === "null") {
				next();
				return { type: "Literal", value: null };
			}
			if (t.value === "undefined") {
				next();
				return { type: "Literal", value: undefined };
			}
		}
		if (t.type === "Punc" && t.value === "[") {
			next();
			const elements = [];
			while (!match("Punc", "]") && pos < tokens.length) {
				elements.push(parseSpreadOrExpr());
				if (match("Punc", ",")) next();
			}
			expect("Punc", "]");
			return { type: "ArrayExpr", elements };
		}
		if (t.type === "Punc" && t.value === "{") return parseObjectLiteral();
		if (t.type === "Punc" && t.value === "(") {
			next();
			if (isArrowParams()) {
				const params = parseArrowParams();
				expect("Punc", ")");
				expect("Op", "=>");
				return { type: "ArrowFunction", params, body: parseExpression() };
			}
			const expr = parseExpression();
			expect("Punc", ")");
			return expr;
		}
		if (t.type === "Ident") {
			next();
			if (match("Op", "=>")) {
				next();
				return {
					type: "ArrowFunction",
					params: [t.value],
					body: parseExpression(),
				};
			}
			return { type: "Identifier", name: t.value };
		}
		next();
		return { type: "Literal", value: undefined };
	}
	function parseObjectLiteral() {
		next();
		const properties = [];
		while (!match("Punc", "}") && pos < tokens.length) {
			if (match("Punc", "...")) {
				next();
				properties.push({ key: null, value: parseExpression(), spread: true });
				if (match("Punc", ",")) next();
				continue;
			}
			if (match("Punc", "[")) {
				next();
				const keyExpr = parseExpression();
				expect("Punc", "]");
				expect("Punc", ":");
				properties.push({
					key: keyExpr,
					value: parseExpression(),
					computed: true,
					spread: false,
				});
				if (match("Punc", ",")) next();
				continue;
			}
			if (match("String")) {
				const keyToken = next();
				if (match("Punc", ":")) {
					next();
					properties.push({
						key: keyToken.value,
						value: parseExpression(),
						computed: false,
						spread: false,
					});
				}
				if (match("Punc", ",")) next();
				continue;
			}
			if (match("Ident") || match("Keyword")) {
				const keyToken = next();
				if (match("Punc", ":")) {
					next();
					properties.push({
						key: keyToken.value,
						value: parseExpression(),
						computed: false,
						spread: false,
					});
				} else {
					properties.push({
						key: keyToken.value,
						value: { type: "Identifier", name: keyToken.value },
						computed: false,
						spread: false,
					});
				}
				if (match("Punc", ",")) next();
				continue;
			}
			if (match("Number")) {
				const keyToken = next();
				if (match("Punc", ":")) {
					next();
					properties.push({
						key: keyToken.value,
						value: parseExpression(),
						computed: false,
						spread: false,
					});
				}
				if (match("Punc", ",")) next();
				continue;
			}
			next();
		}
		expect("Punc", "}");
		return { type: "ObjectExpr", properties };
	}
	function parseTopLevel() {
		const expr = parseExpression();
		const t = peek();
		if (
			t &&
			t.type === "Op" &&
			(t.value === "=" ||
				t.value === "+=" ||
				t.value === "-=" ||
				t.value === "*=" ||
				t.value === "/=" ||
				t.value === "%=")
		) {
			const op = next().value;
			return { type: "AssignExpr", op, left: expr, right: parseExpression() };
		}
		return expr;
	}
	return parseTopLevel();
}

// ── JIT Compiler ───────────────────────────────────────────────────────

const _FORBIDDEN_PROPS = { __proto__: 1, constructor: 1, prototype: 1 };

const _SAFE_GLOBALS = {
	Array,
	Object,
	String,
	Number,
	Boolean,
	Math,
	Date,
	RegExp,
	Map,
	Set,
	JSON,
	parseInt,
	parseFloat,
	isNaN,
	isFinite,
	Infinity,
	NaN,
	undefined,
	Error,
	Symbol,
	console,
};

const _BLOCKED_WINDOW_PROPS = new Set([
	"fetch",
	"XMLHttpRequest",
	"localStorage",
	"sessionStorage",
	"WebSocket",
	"indexedDB",
	"eval",
	"Function",
	"importScripts",
	"open",
	"postMessage",
]);
const _WINDOW_PROXY_OVERRIDES = {};

const _BLOCKED_DOCUMENT_PROPS = new Set([
	"cookie",
	"domain",
	"write",
	"writeln",
	"execCommand",
]);

const _safeWindow =
	typeof globalThis !== "undefined" && typeof globalThis.window !== "undefined"
		? new Proxy(globalThis.window, {
				get(target, prop, receiver) {
					if (typeof prop === "string" && _BLOCKED_WINDOW_PROPS.has(prop))
						return undefined;
					if (typeof prop === "string" && prop in _WINDOW_PROXY_OVERRIDES)
						return _WINDOW_PROXY_OVERRIDES[prop];
					return Reflect.get(target, prop, receiver);
				},
				set(target, prop, value) {
					if (typeof prop === "string" && _BLOCKED_WINDOW_PROPS.has(prop))
						return true;
					if (prop === "name" || prop === "status") return true;
					target[prop] = value;
					return true;
				},
			})
		: undefined;

const _safeDocument =
	typeof globalThis !== "undefined" &&
	typeof globalThis.document !== "undefined"
		? new Proxy(globalThis.document, {
				get(target, prop, receiver) {
					if (typeof prop === "string" && _BLOCKED_DOCUMENT_PROPS.has(prop))
						return undefined;
					if (prop === "defaultView") return _safeWindow;
					return Reflect.get(target, prop, receiver);
				},
				set(target, prop, value) {
					if (typeof prop === "string" && _BLOCKED_DOCUMENT_PROPS.has(prop))
						return true;
					target[prop] = value;
					return true;
				},
			})
		: undefined;

const _LOCATION_READ_PROPS = [
	"href",
	"pathname",
	"search",
	"hash",
	"origin",
	"hostname",
	"port",
	"protocol",
	"host",
];
const _locationNoop = () => {};
const _safeLocation =
	typeof globalThis !== "undefined" &&
	typeof globalThis.location !== "undefined"
		? (() => {
				const loc = {};
				for (const prop of _LOCATION_READ_PROPS) {
					Object.defineProperty(loc, prop, {
						get() {
							return globalThis.location[prop];
						},
						set() {},
						enumerable: true,
						configurable: false,
					});
				}
				loc.assign = _locationNoop;
				loc.replace = _locationNoop;
				loc.reload = _locationNoop;
				loc.toString = () => globalThis.location.href;
				return Object.freeze(loc);
			})()
		: undefined;

const _HISTORY_READ_PROPS = ["length", "state", "scrollRestoration"];
const _safeHistory =
	typeof globalThis !== "undefined" && typeof globalThis.history !== "undefined"
		? (() => {
				const h = {};
				for (const prop of _HISTORY_READ_PROPS) {
					Object.defineProperty(h, prop, {
						get() {
							return globalThis.history[prop];
						},
						enumerable: true,
						configurable: false,
					});
				}
				h.pushState = _locationNoop;
				h.replaceState = _locationNoop;
				h.back = _locationNoop;
				h.forward = _locationNoop;
				h.go = _locationNoop;
				return Object.freeze(h);
			})()
		: undefined;

const _BLOCKED_NAVIGATOR_PROPS = new Set(["sendBeacon", "credentials"]);
const _safeNavigator =
	typeof globalThis !== "undefined" &&
	typeof globalThis.navigator !== "undefined"
		? new Proxy(globalThis.navigator, {
				get(target, prop, receiver) {
					if (typeof prop === "string" && _BLOCKED_NAVIGATOR_PROPS.has(prop))
						return undefined;
					return Reflect.get(target, prop, receiver);
				},
				set() {
					return true;
				},
			})
		: undefined;

if (_safeLocation) _WINDOW_PROXY_OVERRIDES.location = _safeLocation;
if (_safeDocument) _WINDOW_PROXY_OVERRIDES.document = _safeDocument;
if (_safeHistory) _WINDOW_PROXY_OVERRIDES.history = _safeHistory;
if (_safeNavigator) _WINDOW_PROXY_OVERRIDES.navigator = _safeNavigator;

function g(name) {
	if (name === "window") return _safeWindow;
	if (name === "document") return _safeDocument;
	if (name === "location") return _safeLocation;
	if (name === "history") return _safeHistory;
	if (name === "navigator") return _safeNavigator;
	if (name === "console") return console;
	if (name === "setTimeout") return setTimeout;
	if (name === "clearTimeout") return clearTimeout;
	if (name === "setInterval") return setInterval;
	if (name === "clearInterval") return clearInterval;
	if (typeof globalThis === "undefined") return undefined;
	try {
		switch (name) {
			case "performance":
				return typeof performance !== "undefined" ? performance : undefined;
			case "crypto":
				return typeof crypto !== "undefined" ? crypto : undefined;
			case "requestAnimationFrame":
				return typeof requestAnimationFrame !== "undefined"
					? requestAnimationFrame
					: undefined;
			case "cancelAnimationFrame":
				return typeof cancelAnimationFrame !== "undefined"
					? cancelAnimationFrame
					: undefined;
			case "alert":
				return typeof alert !== "undefined" ? alert : undefined;
			case "confirm":
				return typeof confirm !== "undefined" ? confirm : undefined;
			case "prompt":
				return typeof prompt !== "undefined" ? prompt : undefined;
			case "CustomEvent":
				return typeof CustomEvent !== "undefined" ? CustomEvent : undefined;
			case "Event":
				return typeof Event !== "undefined" ? Event : undefined;
			case "URL":
				return typeof URL !== "undefined" ? URL : undefined;
			case "URLSearchParams":
				return typeof URLSearchParams !== "undefined"
					? URLSearchParams
					: undefined;
			case "FormData":
				return typeof FormData !== "undefined" ? FormData : undefined;
			case "FileReader":
				return typeof FileReader !== "undefined" ? FileReader : undefined;
			case "Blob":
				return typeof Blob !== "undefined" ? Blob : undefined;
			case "Promise":
				return typeof Promise !== "undefined" ? Promise : undefined;
		}
	} catch (_e) {
		return undefined;
	}

	return globalThis[name];
}

const _BROWSER_GLOBALS = {
	window: _safeWindow,
	document: _safeDocument,
	console,
	location: _safeLocation,
	history: _safeHistory,
	navigator: _safeNavigator,
	get screen() {
		return g("screen");
	},
	get performance() {
		return g("performance");
	},
	get crypto() {
		return g("crypto");
	},
	get setTimeout() {
		return g("setTimeout");
	},
	get clearTimeout() {
		return g("clearTimeout");
	},
	get setInterval() {
		return g("setInterval");
	},
	get clearInterval() {
		return g("clearInterval");
	},
	get requestAnimationFrame() {
		return g("requestAnimationFrame");
	},
	get cancelAnimationFrame() {
		return g("cancelAnimationFrame");
	},
	get alert() {
		return g("alert");
	},
	get confirm() {
		return g("confirm");
	},
	get prompt() {
		return g("prompt");
	},
	get CustomEvent() {
		return g("CustomEvent");
	},
	get Event() {
		return g("Event");
	},
	get URL() {
		return g("URL");
	},
	get URLSearchParams() {
		return g("URLSearchParams");
	},
	get FormData() {
		return g("FormData");
	},
	get FileReader() {
		return g("FileReader");
	},
	get Blob() {
		return g("Blob");
	},
	get Promise() {
		return g("Promise");
	},
};

function _compileAST(node) {
	if (!node) return "undefined";
	switch (node.type) {
		case "Literal":
			return JSON.stringify(node.value);
		case "Identifier":
			return `(("${node.name}" in scope) ? scope["${node.name}"] : (("${node.name}" in globals) ? globals["${node.name}"] : (typeof window !== "undefined" && "${node.name}" in window && !_BLOCKED_WINDOW_PROPS.has("${node.name}") ? window["${node.name}"] : undefined)))`;
		case "BinaryExpr": {
			const l = _compileAST(node.left);
			const r = _compileAST(node.right);
			if (node.op === "&&") return `(${l} && ${r})`;
			if (node.op === "||") return `(${l} || ${r})`;
			if (node.op === "??") return `((${l} ?? ${r}))`;
			return `(${l} ${node.op} ${r})`;
		}
		case "UnaryExpr": {
			const arg = _compileAST(node.argument);
			if (node.op === "typeof" && node.argument.type === "Identifier") {
				return `(("${node.argument.name}" in scope) ? typeof scope["${node.argument.name}"] : (("${node.argument.name}" in globals) ? typeof globals["${node.argument.name}"] : (typeof window !== "undefined" && "${node.argument.name}" in window && !_BLOCKED_WINDOW_PROPS.has("${node.argument.name}") ? typeof window["${node.argument.name}"] : "undefined")))`;
			}
			return `(${node.op}${arg})`;
		}
		case "ConditionalExpr":
			return `(${_compileAST(node.test)} ? ${_compileAST(node.consequent)} : ${_compileAST(node.alternate)})`;
		case "MemberExpr":
		case "OptionalMemberExpr": {
			const obj = _compileAST(node.object);
			const prop = node.computed
				? _compileAST(node.property)
				: JSON.stringify(node.property.name || node.property.value);
			const op = node.type === "OptionalMemberExpr" ? "?." : "";
			return `(function(o, p){ if(o==null) return undefined; if(p === "__proto__" || p === "constructor" || p === "prototype") return undefined; return o${op}[p]; })(${obj}, ${prop})`;
		}
		case "CallExpr":
		case "OptionalCallExpr": {
			const args = `[${node.args.map((a) => (a.type === "SpreadElement" ? `...${_compileAST(a.argument)}` : _compileAST(a))).join(", ")}]`;
			if (
				node.callee.type === "MemberExpr" ||
				node.callee.type === "OptionalMemberExpr"
			) {
				const obj = _compileAST(node.callee.object);
				const prop = node.callee.computed
					? _compileAST(node.callee.property)
					: JSON.stringify(node.callee.property.name);
				const _op = node.type === "OptionalCallExpr" ? "?." : "";
				return `(function(o, p, a){ if(o==null) return undefined; if(p === "__proto__" || p === "constructor" || p === "prototype") return undefined; const f = o[p]; if(typeof f !== "function") return undefined; return f.apply(o, a); })(${obj}, ${prop}, ${args})`;
			}
			const fn = _compileAST(node.callee);
			return `(function(f, a){ if(typeof f !== "function") return undefined; return f.apply(undefined, a); })(${fn}, ${args})`;
		}
		case "ArrayExpr":
			return `[${node.elements.map((e) => (e.type === "SpreadElement" ? `...${_compileAST(e.argument)}` : _compileAST(e))).join(", ")}]`;
		case "ObjectExpr": {
			const props = node.properties
				.map((p) => {
					if (p.spread) return `...${_compileAST(p.value)}`;
					const key = p.computed ? _compileAST(p.key) : JSON.stringify(p.key);
					return `[${key}]: ${_compileAST(p.value)}`;
				})
				.join(", ");
			return `(function(){ const o = {${props}}; delete o.__proto__; delete o.constructor; delete o.prototype; return o; })()`;
		}
		case "ArrowFunction": {
			const params = node.params.join(", ");
			const body = _compileAST(node.body);
			return `((${params}) => { const childScope = Object.create(scope); ${node.params.map((p) => `childScope["${p.replace("...", "")}"] = ${p.replace("...", "")};`).join(" ")} return (function(scope){ return ${body}; })(childScope); })`;
		}
		case "TemplateLiteral": {
			let res = JSON.stringify(node.parts[0]);
			for (let i = 0; i < node.expressions.length; i++) {
				res += ` + String(${_compileAST(node.expressions[i])}) + ${JSON.stringify(node.parts[i + 1])}`;
			}
			return `(${res})`;
		}
		default:
			return "undefined";
	}
}

function _parsePipes(exprStr) {
	const parts = [];
	let current = "";
	let depth = 0;
	let inStr = false;
	let strChar = "";
	for (let i = 0; i < exprStr.length; i++) {
		const ch = exprStr[i];
		if (inStr) {
			current += ch;
			if (ch === strChar && exprStr[i - 1] !== "\\") inStr = false;
			continue;
		}
		if (ch === "'" || ch === '"' || ch === "`") {
			inStr = true;
			strChar = ch;
			current += ch;
			continue;
		}
		if (ch === "(" || ch === "[" || ch === "{") {
			depth++;
			current += ch;
			continue;
		}
		if (ch === ")" || ch === "]" || ch === "}") {
			depth--;
			current += ch;
			continue;
		}
		if (
			ch === "|" &&
			depth === 0 &&
			exprStr[i + 1] !== "|" &&
			exprStr[i - 1] !== "|"
		) {
			parts.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	parts.push(current.trim());
	return parts;
}

function _applyFilter(value, filterStr) {
	const colonIdx = filterStr.indexOf(":");
	let name, argStr;
	if (colonIdx === -1) {
		name = filterStr.trim();
		argStr = null;
	} else {
		name = filterStr.substring(0, colonIdx).trim();
		argStr = filterStr.substring(colonIdx + 1).trim();
	}
	const fn = _filters[name];
	if (!fn) {
		_warn(`Unknown filter: ${name}`);
		return value;
	}
	const args = argStr ? _parseFilterArgs(argStr) : [];
	return fn(value, ...args);
}

function _parseFilterArgs(str) {
	const args = [];
	let current = "";
	let inStr = false;
	let strChar = "";
	for (const ch of str) {
		if (inStr) {
			if (ch === strChar) {
				inStr = false;
				continue;
			}
			current += ch;
			continue;
		}
		if (ch === "'" || ch === '"') {
			inStr = true;
			strChar = ch;
			continue;
		}
		if (ch === ",") {
			args.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	if (current.trim()) args.push(current.trim());
	return args.map((a) => {
		const n = Number(a);
		return Number.isNaN(n) ? a : n;
	});
}

const _ALL_GLOBALS = { ..._SAFE_GLOBALS, ..._BROWSER_GLOBALS };

export function evaluate(expr, ctx) {
	if (expr == null || expr === "") return undefined;
	try {
		if (ctx == null) throw new TypeError("ctx is required");
		const pipes = _parsePipes(expr);
		const mainExpr = pipes[0];

		let jit = _exprCache.get(mainExpr);
		if (!jit) {
			const ast = _parseExpr(_tokenize(mainExpr));
			const code = _compileAST(ast);
			jit = new Function(
				"scope",
				"globals",
				`try { return ${code}; } catch(e) { return undefined; }`,
			);
			_exprCache.set(mainExpr, jit);
		}

		// Pass the context proxy as scope to enable fine-grained tracking
		let result = jit(ctx, _ALL_GLOBALS);

		for (let i = 1; i < pipes.length; i++) {
			result = _applyFilter(result, pipes[i]);
		}
		return result;
	} catch (e) {
		_warn("Expression error:", expr, e.message);
		return undefined;
	}
}

function _parseStatements(expr) {
	if (_stmtCache.has(expr)) return _stmtCache.get(expr);
	const tokens = _tokenize(expr);
	const stmts = [];
	let start = 0;
	for (let i = 0; i <= tokens.length; i++) {
		if (
			i === tokens.length ||
			(tokens[i].type === "Punc" && tokens[i].value === ";")
		) {
			const chunk = tokens.slice(start, i);
			if (chunk.length > 0) stmts.push(_parseExpr(chunk));
			start = i + 1;
		}
	}
	_stmtCache.set(expr, stmts);
	return stmts;
}

function _evalNode(node, scope) {
	return new Function(
		"scope",
		"globals",
		`try { return ${_compileAST(node)}; } catch(e) { return undefined; }`,
	)(scope, _ALL_GLOBALS);
}

function _assignToTarget(target, value, scope) {
	if (target.type === "Identifier") {
		scope[target.name] = value;
	} else if (
		target.type === "MemberExpr" ||
		target.type === "OptionalMemberExpr"
	) {
		const obj = _evalNode(target.object, scope);
		if (obj == null) return;
		const prop = target.computed
			? _evalNode(target.property, scope)
			: target.property.name || target.property.value;
		if (_FORBIDDEN_PROPS[prop]) return;
		obj[prop] = value;
	}
}

function _execStmtNode(node, scope) {
	if (!node) return undefined;
	switch (node.type) {
		case "AssignExpr": {
			const rhs = _evalNode(node.right, scope);
			let value;
			if (node.op === "=") value = rhs;
			else {
				const lhs = _evalNode(node.left, scope);
				switch (node.op) {
					case "+=":
						value = lhs + rhs;
						break;
					case "-=":
						value = lhs - rhs;
						break;
					case "*=":
						value = lhs * rhs;
						break;
					case "/=":
						value = lhs / rhs;
						break;
					case "%=":
						value = lhs % rhs;
						break;
					default:
						value = rhs;
				}
			}
			_assignToTarget(node.left, value, scope);
			return value;
		}
		case "PostfixExpr": {
			const oldVal = _evalNode(node.argument, scope);
			const newVal = node.op === "++" ? oldVal + 1 : oldVal - 1;
			_assignToTarget(node.argument, newVal, scope);
			return oldVal;
		}
		case "UnaryExpr": {
			if (node.op === "++" || node.op === "--") {
				const oldVal = _evalNode(node.argument, scope);
				const newVal = node.op === "++" ? oldVal + 1 : oldVal - 1;
				_assignToTarget(node.argument, newVal, scope);
				return newVal;
			}
			return _evalNode(node, scope);
		}
		default:
			return _evalNode(node, scope);
	}
}

export function _execStatement(expr, ctx, extraVars = {}) {
	try {
		const { vals } = _collectKeys(ctx);
		const scope = { ...vals };
		if (!("$store" in scope)) scope.$store = _stores;
		if (!("$route" in scope)) scope.$route = _routerInstance?.current;
		if (!("$router" in scope)) scope.$router = _routerInstance;
		if (!("$i18n" in scope)) scope.$i18n = _i18n;
		if (!("$refs" in scope)) scope.$refs = ctx.$refs;
		for (const gk in _globals) {
			const key = `$${gk}`;
			if (!(key in scope)) scope[key] = _globals[gk];
		}
		Object.assign(scope, extraVars);

		const chainKeys = new Set();
		let _wCtx = ctx;
		while (_wCtx?.__isProxy) {
			for (const k of Object.keys(_wCtx.__raw)) chainKeys.add(k);
			_wCtx = _wCtx.$parent;
		}
		const originals = {};
		for (const k of chainKeys) {
			if (!k.startsWith("$") && k in scope) originals[k] = scope[k];
		}

		const stmts = _parseStatements(expr);
		for (let i = 0; i < stmts.length; i++) _execStmtNode(stmts[i], scope);

		for (const k of chainKeys) {
			if (k.startsWith("$")) continue;
			if (!(k in scope)) continue;
			const newVal = scope[k];
			const oldVal = originals[k];
			if (newVal !== oldVal) {
				let c = ctx;
				while (c?.__isProxy) {
					if (k in c.__raw) {
						c.$set(k, newVal);
						break;
					}
					c = c.$parent;
				}
			} else if (typeof newVal === "object" && newVal !== null) {
				let c = ctx;
				while (c?.__isProxy) {
					if (k in c.__raw) {
						c.$notify();
						break;
					}
					c = c.$parent;
				}
			}
		}
		for (const k in scope) {
			if (k.startsWith("$") || chainKeys.has(k) || k in extraVars) continue;
			ctx.$set(k, scope[k]);
		}
		if (typeof expr === "string" && expr.includes("$store")) {
			_notifyStoreWatchers();
		}
	} catch (e) {
		_warn("Expression error:", expr, e.message);
		if (extraVars.$el) {
			extraVars.$el.dispatchEvent(
				new CustomEvent("nojs:error", {
					bubbles: true,
					detail: { message: e.message, error: e },
				}),
			);
		}
	}
}

export function resolve(path, ctx) {
	return path.split(".").reduce((o, k) => o?.[k], ctx);
}

export function _interpolate(str, ctx) {
	return str.replace(/\{([^}]+)\}/g, (_, expr) => {
		const val = evaluate(expr.trim(), ctx);
		if (val == null) return "";
		return encodeURIComponent(String(val));
	});
}
