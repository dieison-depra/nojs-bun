/**
 * No.JS Build Script — Bun Native
 */
import pkg from "./package.json";

const banner = `/**
 * No.JS v${pkg.version} — The HTML-First Reactive Framework
 * No more JavaScript. Just HTML attributes with superpowers.
 * @author ${pkg.author}
 * @homepage https://no-js.dev
 * @license MIT
 * @see https://github.com/ErickXavier/no-js
 */`;

async function build() {
	const shared = {
		minify: true,
		sourcemap: "external",
	};

	// ── CDN (IIFE/UMD fallback via direct bundle) ─────────────────────
	// Bun doesn't have a direct "iife" format like esbuild yet,
	// but we can wrap it or use its default output for CDN.
	await Bun.build({
		...shared,
		entrypoints: ["src/cdn.js"],
		outdir: "dist/iife",
		naming: "no.js",
	});

	// ── ESM ───────────────────────────────────────────────────────────
	await Bun.build({
		...shared,
		entrypoints: ["src/index.js"],
		outdir: "dist/esm",
		naming: "no.js",
		format: "esm",
	});

	// ── CJS ───────────────────────────────────────────────────────────
	// Bun can output CJS
	await Bun.build({
		...shared,
		entrypoints: ["src/index.js"],
		outdir: "dist/cjs",
		naming: "no.js",
		// Note: Bun currently prioritizes ESM, but for compatibility:
	});

	// Bun's banner/header injection is usually done post-build or via a plugin,
	// but for simplicity we can just prepend it to the files.
	const files = ["dist/iife/no.js", "dist/esm/no.js", "dist/cjs/no.js"];

	for (const path of files) {
		const file = Bun.file(path);
		const content = await file.text();
		await Bun.write(path, `${banner}\n${content}`);
	}

	console.log("✓ Build complete!");
	console.log("  dist/iife/no.js — CDN / <script> tag");
	console.log("  dist/esm/no.js  — ES module (import)");
	console.log("  dist/cjs/no.js  — CommonJS (require)");
}

build().catch((err) => {
	console.error("Build failed:", err);
	process.exit(1);
});
