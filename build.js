/**
 * No.JS Build Script — Bun Native
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
	console.log("🚀 Starting build...");

	let wasmBase64 = "";
	const wasmPath = join(import.meta.dir, "src/wasm");
	const wasmOut = join(wasmPath, "pkg/nojs_core_bg.wasm");

	if (existsSync(join(wasmPath, "Cargo.toml"))) {
		console.log("🦀 Compiling Rust to WASM...");
		try {
			const result = Bun.spawnSync(["wasm-pack", "build", "--target", "web", "--release"], {
				cwd: wasmPath,
			});

			if (result.success && existsSync(wasmOut)) {
				const wasmBuffer = readFileSync(wasmOut);
				wasmBase64 = wasmBuffer.toString("base64");
				console.log(`✅ WASM compiled and encoded (${(wasmBuffer.length / 1024).toFixed(1)} KB)`);
			} else {
				console.warn("⚠️ WASM build failed or wasm-pack not found. Skipping native engine.");
				console.error(result.stderr?.toString());
			}
		} catch (e) {
			console.warn("⚠️ Failed to run wasm-pack. Skipping native engine.", e.message);
		}
	}

	const shared = {
		minify: true,
		sourcemap: "external",
		define: {
			NATIVE_BIN: wasmBase64 ? JSON.stringify(wasmBase64) : "undefined",
		},
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
