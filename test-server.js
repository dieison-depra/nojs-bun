/**
 * No.JS Test Server — Bun Native
 */
import path from "node:path";

const PORT = 3000;
const ROOT = import.meta.dir;
const LOCAL_BUILD = path.join(ROOT, "dist/iife/no.js");

const CDN_PATTERN = /https:\/\/cdn\.no-js\.dev\//g;
const LOCAL_SCRIPT = "/__local__/no.js";

const MIME = {
	".html": "text/html",
	".css": "text/css",
	".js": "application/javascript",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".map": "application/json",
	".tpl": "text/html",
	".md": "text/markdown",
};

const server = Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const pathname = url.pathname;

		// ── Serve local build at /__local__/no.js ──
		if (pathname === LOCAL_SCRIPT) {
			return new Response(Bun.file(LOCAL_BUILD));
		}

		// ── SPA fallback: root or extensionless path → docs/index.html ──
		let filePath = path.join(
			ROOT,
			pathname === "/" ? "docs/index.html" : pathname,
		);
		if (!path.extname(pathname)) filePath = path.join(ROOT, "docs/index.html");

		const file = Bun.file(filePath);
		if (!(await file.exists())) {
			return new Response("Not Found", { status: 404 });
		}

		const ext = path.extname(filePath);

		// ── For HTML files: rewrite CDN URL → local path on-the-fly ──
		if (ext === ".html") {
			const html = await file.text();
			const rewritten = html.replace(CDN_PATTERN, LOCAL_SCRIPT);
			return new Response(rewritten, {
				headers: { "Content-Type": "text/html" },
			});
		}

		return new Response(file, {
			headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
		});
	},
});

console.log(`\n  🚀 No.JS Test Server — http://localhost:${server.port}`);
console.log(`  📁 Serving from project root: ${ROOT}\n`);
