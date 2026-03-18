/**
 * No.JS Dev Server — Bun Native
 */
import path from "node:path";

const PORT = 3000;
const DOCS = import.meta.dir;
const PROJECT = path.resolve(DOCS, "..");
const LOCAL_BUILD = path.join(PROJECT, "dist/iife/no.js");

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
			console.log(`  ⚡ serving local build → dist/iife/no.js`);
			return new Response(Bun.file(LOCAL_BUILD));
		}

		// ── SPA fallback: any extensionless path → index.html ──
		let filePath = path.join(DOCS, pathname === "/" ? "index.html" : pathname);
		if (!path.extname(pathname)) filePath = path.join(DOCS, "index.html");

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

console.log(`\n  🚀 No.JS Docs — http://localhost:${server.port}`);
console.log(`  ⚡ cdn.no-js.dev → local build (on-the-fly rewrite)`);
console.log(`  📁 ${LOCAL_BUILD}\n`);
