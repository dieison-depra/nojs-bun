// ═══════════════════════════════════════════════════════════════════════════
//  keyed-vs-rebuild.bench.spec.ts
//
//  Playwright/Chromium CDP benchmark: keyed reconciliation vs full-rebuild
//  in a real browser with layout, JIT, and processTree() cost included.
//
//  Run: npx playwright test --config playwright.bench.config.js
//
//  Why this exists:
//    The JSDOM benchmark (loops-benchmark.test.js) cannot capture real
//    browser costs: insertBefore in JSDOM is a pure linked-list op with no
//    layout recalculation, and processTree() is far cheaper without CSS
//    computation or property access side-effects.
//    This benchmark runs the same scenarios in Chromium via CDP so the
//    numbers reflect production conditions.
//
//  Scenarios:
//    S1 — push:    append one item at end
//    S2 — reverse: full sort reversal (worst case for keyed reorder)
//    S3 — splice:  remove one item from the middle
//    S4 — update:  same keys, all item data changed (in-place update)
//    S5 — replace: all new IDs, zero key overlap (worst case for keyed removal)
//
//  List sizes: 50, 200, 500
//  Runs per cell: 7  (first 2 discarded as JIT warmup)
//
//  Metrics per scenario×size×strategy:
//    - wall-clock time (performance.now() inside browser, synchronous)
//    - ScriptDuration delta (CDP Performance.getMetrics)
//    - DOM Nodes delta (CDP)
//    - JS heap delta (CDP)
//
//  Overlap-threshold sweep (third describe block):
//    Measures keyed vs full-rebuild at overlap fractions 0%→50% to find the
//    empirical break-even fraction for the Opt 5 overlap-threshold bailout.
//    See analysis_keyed_recon.md § Optimization 5 for context.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "@playwright/test";

const IIFE_SOURCE = readFileSync(
	resolve(process.cwd(), "dist/iife/no.js"),
	"utf8",
);

// Build a variant of the IIFE with _zeroOverlapBailout disabled — used only
// by the bailout-impact describe block to produce an apples-to-apples diff.
async function buildNoBailoutIIFE(): Promise<string> {
	const noBailoutPlugin: import("bun").BunPlugin = {
		name: "no-bailout",
		setup(build) {
			build.onLoad({ filter: /loops\.js$/ }, (args) => {
				let source = readFileSync(args.path, "utf8");
				// Replace both calls to _zeroOverlapBailout with a no-op so the
				// per-item removal loop always runs (pre-PR #25 behaviour).
				source = source.replace(
					/\s*\/\/ Zero-overlap bailout[^\n]*\n\s*_zeroOverlapBailout\(keyMap, nextKeySet, el\);/g,
					"",
				);
				return { contents: source, loader: "js" };
			});
		},
	};

	const result = await Bun.build({
		entrypoints: [resolve(process.cwd(), "src/cdn.js")],
		target: "browser",
		format: "iife",
		minify: true,
		plugins: [noBailoutPlugin],
	});
	return await result.outputs[0].text();
}

const RUNS = 7;
const WARMUP = 2;
const SIZES = [50, 200, 500];

// ─── Data helpers (run in Node, passed into browser) ─────────────────────────

function makeItems(n, offset = 0) {
	return Array.from({ length: n }, (_, i) => ({
		id: offset + i + 1,
		name: `item-${offset + i + 1}`,
		score: ((offset + i + 1) * 7) % 100,
	}));
}

// ─── Overlap scenario builder ─────────────────────────────────────────────────

// Builds a before/after pair where exactly `Math.round(overlapFraction * n)`
// keys from `before` survive in `after`. Surviving items are updated (score+1)
// so the keyed path exercises the Object.assign+$notify update branch, not just
// a no-op. New items occupy the tail slots with IDs starting at n*100 to
// guarantee no accidental ID collision.
//
// The after list is NOT shuffled: survivors are at the front, new items at the
// end. This deliberately avoids triggering any prefix-sync optimization (which
// does not exist yet) so the benchmark measures the raw reconciliation cost.
function makeOverlapScenario(n: number, overlapFraction: number) {
	const before = makeItems(n);
	const survivorCount = Math.round(overlapFraction * n);
	const after = [
		...before
			.slice(0, survivorCount)
			.map((item) => ({ ...item, score: item.score + 1 })),
		...makeItems(n - survivorCount, n * 100),
	];
	return { before, after, survivorCount };
}

// ─── Scenario definitions ─────────────────────────────────────────────────────

function buildScenarios(n) {
	const base = makeItems(n);
	return {
		S1_push: {
			label: "push (append 1)",
			before: base,
			after: [...base, { id: n + 9999, name: `item-new`, score: 42 }],
		},
		S2_reverse: {
			label: "reverse (full sort)",
			before: base,
			after: [...base].reverse(),
		},
		S3_splice: {
			label: "splice (remove middle)",
			before: base,
			after: base.filter((_, i) => i !== Math.floor(n / 2)),
		},
		S4_update: {
			label: "update (same keys, new data)",
			before: base,
			after: base.map((item) => ({
				...item,
				score: item.score + 1,
				name: `${item.name}!`,
			})),
		},
		S5_replace: {
			label: "replace (zero key overlap)",
			before: base,
			after: makeItems(n, n * 10),
		},
	};
}

// ─── Page setup ───────────────────────────────────────────────────────────────

async function setupPageWithIIFE(page, initialItems, iifeSource: string) {
	const stateJson = JSON.stringify({ items: initialItems });
	await page.setContent(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <template id="bench-tpl">
    <div class="row">
      <span class="name" bind="item.name"></span>
      <span class="score" bind="item.score"></span>
    </div>
  </template>
  <div id="ks" state='${stateJson}'>
    <div id="kl" each="item in items" template="bench-tpl" key="item.id"></div>
  </div>
  <div id="rs" state='${stateJson}'>
    <div id="rl" each="item in items" template="bench-tpl"></div>
  </div>
</body>
</html>`);
	await page.addScriptTag({ content: iifeSource });
	await page.waitForFunction(
		(n) =>
			document.getElementById("kl")?.children.length === n &&
			document.getElementById("rl")?.children.length === n,
		initialItems.length,
	);
}

async function setupPage(page, initialItems) {
	await setupPageWithIIFE(page, initialItems, IIFE_SOURCE);
}

// ─── CDP helpers ─────────────────────────────────────────────────────────────

async function getCDPMetrics(page) {
	const client = await page.context().newCDPSession(page);
	await client.send("Performance.enable");
	const { metrics } = await client.send("Performance.getMetrics");
	await client.detach();
	const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
	return {
		scriptDuration: m.ScriptDuration ?? 0,
		nodes: m.Nodes ?? 0,
		heap: m.JSHeapUsedSize ?? 0,
	};
}

async function forceGC(page) {
	const client = await page.context().newCDPSession(page);
	await client.send("HeapProfiler.collectGarbage");
	await client.detach();
}

// ─── Core timing ─────────────────────────────────────────────────────────────

/**
 * Runs `RUNS` iterations of a state mutation on one context inside the
 * browser and returns the raw wall-clock times (ms) from performance.now().
 * The first `WARMUP` samples are discarded before computing stats.
 */
async function timeOperation(page, ctxId, beforeItems, afterItems) {
	const samples = await page.evaluate(
		({ ctxId, beforeItems, afterItems, RUNS, WARMUP }) => {
			const el = document.getElementById(ctxId);
			const ctx = el?.__ctx;
			if (!ctx) return [];

			const times = [];
			for (let i = 0; i < RUNS; i++) {
				// Reset to before state.
				ctx.__raw.items = JSON.parse(JSON.stringify(beforeItems));
				ctx.$notify();

				// Measure the operation.
				const t0 = performance.now();
				ctx.__raw.items = JSON.parse(JSON.stringify(afterItems));
				ctx.$notify();
				times.push(performance.now() - t0);
			}
			return times.slice(WARMUP);
		},
		{ ctxId: ctxId, beforeItems, afterItems, RUNS, WARMUP },
	);
	return samples;
}

function stats(samples) {
	if (!samples.length) return { avg: 0, min: 0, max: 0, median: 0 };
	const sorted = [...samples].sort((a, b) => a - b);
	const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
	return {
		avg: +avg.toFixed(3),
		min: +sorted[0].toFixed(3),
		max: +sorted[sorted.length - 1].toFixed(3),
		median: +sorted[Math.floor(sorted.length / 2)].toFixed(3),
	};
}

function ratio(keyed, rebuild) {
	if (rebuild === 0) return "—";
	const r = keyed / rebuild;
	return `${r.toFixed(2)}x ${r <= 1 ? "✓ keyed faster" : "△ rebuild faster"}`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("Keyed reconciliation vs full-rebuild — real browser (Chromium)", () => {
	test.skip(
		({ browserName }) => browserName !== "chromium",
		"CDP metrics require Chromium",
	);

	for (const n of SIZES) {
		test(`n=${n} — all scenarios`, async ({ page }) => {
			test.setTimeout(120_000);

			const scenarios = buildScenarios(n);
			const results = [];

			console.log(`\n${"═".repeat(72)}`);
			console.log(
				`  No.JS — keyed vs full-rebuild benchmark  (n=${n}, real Chromium)`,
			);
			console.log(`${"═".repeat(72)}`);
			console.log(
				`  ${"Scenario".padEnd(30)} ${"Strategy".padEnd(10)} ${"avg ms".padStart(8)} ${"min".padStart(8)} ${"max".padStart(8)} ${"median".padStart(8)}`,
			);
			console.log(`  ${"-".repeat(70)}`);

			for (const [_key, scenario] of Object.entries(scenarios)) {
				await setupPage(page, scenario.before);

				// Measure keyed.
				const keyedSamples = await timeOperation(
					page,
					"ks",
					scenario.before,
					scenario.after,
				);
				const keyedStats = stats(keyedSamples);

				// Measure rebuild.
				const rebuildSamples = await timeOperation(
					page,
					"rs",
					scenario.before,
					scenario.after,
				);
				const rebuildStats = stats(rebuildSamples);

				// CDP bulk metrics for keyed (single run after warmup).
				await forceGC(page);
				const beforeCDP = await getCDPMetrics(page);
				await page.evaluate(
					({ beforeItems, afterItems }) => {
						const ctx = document.getElementById("ks")?.__ctx;
						if (!ctx) return;
						ctx.__raw.items = JSON.parse(JSON.stringify(beforeItems));
						ctx.$notify();
						ctx.__raw.items = JSON.parse(JSON.stringify(afterItems));
						ctx.$notify();
					},
					{ beforeItems: scenario.before, afterItems: scenario.after },
				);
				const afterCDP = await getCDPMetrics(page);

				const cdp = {
					scriptDeltaMs: +(
						(afterCDP.scriptDuration - beforeCDP.scriptDuration) *
						1000
					).toFixed(3),
					nodesDelta: afterCDP.nodes - beforeCDP.nodes,
					heapDeltaKB: +((afterCDP.heap - beforeCDP.heap) / 1024).toFixed(1),
				};

				results.push({
					scenario: scenario.label,
					n,
					keyed: keyedStats,
					rebuild: rebuildStats,
					cdp,
				});

				console.log(
					`  ${scenario.label.padEnd(30)} ${"keyed".padEnd(10)} ${String(keyedStats.avg).padStart(8)} ${String(keyedStats.min).padStart(8)} ${String(keyedStats.max).padStart(8)} ${String(keyedStats.median).padStart(8)}`,
				);
				console.log(
					`  ${"".padEnd(30)} ${"rebuild".padEnd(10)} ${String(rebuildStats.avg).padStart(8)} ${String(rebuildStats.min).padStart(8)} ${String(rebuildStats.max).padStart(8)} ${String(rebuildStats.median).padStart(8)}`,
				);
				console.log(
					`  ${"".padEnd(30)} ${"ratio".padEnd(10)} ${ratio(keyedStats.median, rebuildStats.median).padStart(34)}`,
				);
				console.log(
					`  ${"".padEnd(30)} ${"cdp".padEnd(10)} script Δ${String(cdp.scriptDeltaMs).padStart(6)}ms  nodes Δ${String(cdp.nodesDelta).padStart(5)}  heap Δ${String(cdp.heapDeltaKB).padStart(7)}KB`,
				);
				console.log(`  ${"-".repeat(70)}`);
			}

			// Summary table.
			console.log(`\n  SUMMARY (n=${n}, median ms — lower is better)`);
			console.log(
				`  ${"Scenario".padEnd(30)} ${"keyed".padStart(10)} ${"rebuild".padStart(10)} ${"ratio".padStart(20)}`,
			);
			console.log(`  ${"-".repeat(72)}`);
			for (const r of results) {
				console.log(
					`  ${r.scenario.padEnd(30)} ${String(r.keyed.median).padStart(10)} ${String(r.rebuild.median).padStart(10)} ${ratio(r.keyed.median, r.rebuild.median).padStart(20)}`,
				);
			}
			console.log(`${"═".repeat(72)}\n`);
		});
	}
});

// ─── Bailout impact: with vs without _zeroOverlapBailout (S5 only) ───────────

test.describe("S5 zero-overlap bailout impact — keyed with vs without PR #25", () => {
	test.skip(
		({ browserName }) => browserName !== "chromium",
		"CDP metrics require Chromium",
	);

	let IIFE_NO_BAILOUT = "";

	test.beforeAll(async () => {
		IIFE_NO_BAILOUT = await buildNoBailoutIIFE();
	});

	for (const n of SIZES) {
		test(`n=${n} — S5 replace (zero key overlap)`, async ({ page }) => {
			test.setTimeout(60_000);

			const before = makeItems(n);
			const after = makeItems(n, n * 10);

			// ── With bailout (PR #25) ──────────────────────────────────────────────
			await setupPageWithIIFE(page, before, IIFE_SOURCE);
			const withSamples = await timeOperation(page, "ks", before, after);
			const withStats = stats(withSamples);

			// ── Without bailout (pre-PR #25) ──────────────────────────────────────
			await setupPageWithIIFE(page, before, IIFE_NO_BAILOUT);
			const withoutSamples = await timeOperation(page, "ks", before, after);
			const withoutStats = stats(withoutSamples);

			// ── Full-rebuild reference ─────────────────────────────────────────────
			await setupPageWithIIFE(page, before, IIFE_SOURCE);
			const rebuildSamples = await timeOperation(page, "rs", before, after);
			const rebuildStats = stats(rebuildSamples);

			console.log(`\n${"═".repeat(72)}`);
			console.log(
				`  S5 zero-overlap bailout impact  (n=${n}, S5 replace, real Chromium)`,
			);
			console.log(`${"═".repeat(72)}`);
			console.log(
				`  ${"Strategy".padEnd(28)} ${"avg ms".padStart(8)} ${"min".padStart(8)} ${"max".padStart(8)} ${"median".padStart(8)}`,
			);
			console.log(`  ${"-".repeat(56)}`);
			console.log(
				`  ${"keyed WITH bailout (PR #25)".padEnd(28)} ${String(withStats.avg).padStart(8)} ${String(withStats.min).padStart(8)} ${String(withStats.max).padStart(8)} ${String(withStats.median).padStart(8)}`,
			);
			console.log(
				`  ${"keyed WITHOUT bailout".padEnd(28)} ${String(withoutStats.avg).padStart(8)} ${String(withoutStats.min).padStart(8)} ${String(withoutStats.max).padStart(8)} ${String(withoutStats.median).padStart(8)}`,
			);
			console.log(
				`  ${"full-rebuild (reference)".padEnd(28)} ${String(rebuildStats.avg).padStart(8)} ${String(rebuildStats.min).padStart(8)} ${String(rebuildStats.max).padStart(8)} ${String(rebuildStats.median).padStart(8)}`,
			);
			console.log(`  ${"-".repeat(56)}`);

			const bailoutGain = withoutStats.median / withStats.median;
			const _vsRebuild = withStats.median / rebuildStats.median;
			console.log(
				`  Bailout gain (without/with):    ${bailoutGain.toFixed(2)}x faster`,
			);
			console.log(
				`  Keyed+bailout vs rebuild:       ${ratio(withStats.median, rebuildStats.median)}`,
			);
			console.log(`${"═".repeat(72)}\n`);
		});
	}
});

// ─── Overlap-threshold sweep: empirical break-even fraction for Opt 5 ─────────
//
// Sweeps key-overlap fractions from 0% to 50% and measures:
//   - keyed (current, includes zero-overlap bailout from _zeroOverlapBailout)
//   - keyed-no-bailout (esbuild variant with bailout calls stripped)
//   - full-rebuild (no `key` attribute)
//
// Goal: find the empirical overlap fraction at which keyed breaks even with
// full-rebuild, and assess whether the zero-overlap bailout helps at low fractions.
// This data drives the threshold value for Opt 5 in analysis_keyed_recon.md.

test.describe("Overlap-threshold sweep — empirical break-even for Opt 5", () => {
	test.skip(
		({ browserName }) => browserName !== "chromium",
		"CDP metrics require Chromium",
	);

	const OVERLAP_FRACTIONS = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5];

	let IIFE_NO_BAILOUT = "";

	test.beforeAll(async () => {
		IIFE_NO_BAILOUT = await buildNoBailoutIIFE();
	});

	for (const n of SIZES) {
		test(`n=${n} — overlap sweep`, async ({ page }) => {
			test.setTimeout(300_000);

			console.log(`\n${"═".repeat(80)}`);
			console.log(`  Overlap-threshold sweep  (n=${n}, real Chromium)`);
			console.log(
				`  Goal: find break-even fraction where keyed == full-rebuild`,
			);
			console.log(`${"═".repeat(80)}`);
			console.log(
				`  ${"overlap".padEnd(10)} ${"survivors".padEnd(10)} ${"keyed".padStart(10)} ${"no-bail".padStart(10)} ${"rebuild".padStart(10)} ${"k/r ratio".padStart(14)} ${"verdict".padStart(18)}`,
			);
			console.log(`  ${"-".repeat(76)}`);

			const results: Array<{
				fraction: number;
				survivorCount: number;
				keyed: ReturnType<typeof stats>;
				noBailout: ReturnType<typeof stats>;
				rebuild: ReturnType<typeof stats>;
			}> = [];

			for (const fraction of OVERLAP_FRACTIONS) {
				const { before, after, survivorCount } = makeOverlapScenario(
					n,
					fraction,
				);

				// ── Keyed with current bailout ─────────────────────────────────────
				await setupPageWithIIFE(page, before, IIFE_SOURCE);
				const keyedSamples = await timeOperation(page, "ks", before, after);
				const keyedStats = stats(keyedSamples);

				// ── Keyed without zero-overlap bailout ────────────────────────────
				await setupPageWithIIFE(page, before, IIFE_NO_BAILOUT);
				const noBailoutSamples = await timeOperation(page, "ks", before, after);
				const noBailoutStats = stats(noBailoutSamples);

				// ── Full-rebuild reference ─────────────────────────────────────────
				await setupPageWithIIFE(page, before, IIFE_SOURCE);
				const rebuildSamples = await timeOperation(page, "rs", before, after);
				const rebuildStats = stats(rebuildSamples);

				results.push({
					fraction,
					survivorCount,
					keyed: keyedStats,
					noBailout: noBailoutStats,
					rebuild: rebuildStats,
				});

				const pct = `${Math.round(fraction * 100)}%`;
				const r =
					rebuildStats.median > 0 ? keyedStats.median / rebuildStats.median : 0;
				const verdict = r <= 1.0 ? "✓ keyed faster" : "△ rebuild faster";

				console.log(
					`  ${pct.padEnd(10)} ${String(survivorCount).padEnd(10)} ${String(keyedStats.median).padStart(10)} ${String(noBailoutStats.median).padStart(10)} ${String(rebuildStats.median).padStart(10)} ${(`${r.toFixed(2)}x`).padStart(14)} ${verdict.padStart(18)}`,
				);
			}

			// ── Break-even analysis ──────────────────────────────────────────────
			console.log(`\n  BREAK-EVEN ANALYSIS (n=${n}, median ms)`);
			console.log(`  ${"-".repeat(76)}`);

			// Find the first fraction where keyed beats rebuild.
			const breakEven = results.find((r) => r.keyed.median <= r.rebuild.median);
			if (breakEven) {
				console.log(
					`  Break-even at overlap=${Math.round(breakEven.fraction * 100)}% ` +
						`(${breakEven.survivorCount}/${n} survivors survive)`,
				);
			} else {
				console.log(
					`  No break-even found in tested range — keyed slower than rebuild at all overlap levels`,
				);
			}

			// Bailout delta: at each fraction, does the bailout help?
			console.log(
				`\n  BAILOUT IMPACT (keyed-no-bailout vs keyed-with-bailout, median ms)`,
			);
			console.log(`  ${"-".repeat(76)}`);
			console.log(
				`  ${"overlap".padEnd(10)} ${"no-bail".padStart(10)} ${"with-bail".padStart(12)} ${"gain".padStart(12)} ${"helps?".padStart(10)}`,
			);
			console.log(`  ${"-".repeat(58)}`);
			for (const r of results) {
				const pct = `${Math.round(r.fraction * 100)}%`;
				const gain =
					r.noBailout.median > 0 ? r.noBailout.median / r.keyed.median : 1;
				const helps = gain >= 1.05 ? "yes" : gain <= 0.95 ? "hurts" : "neutral";
				console.log(
					`  ${pct.padEnd(10)} ${String(r.noBailout.median).padStart(10)} ${String(r.keyed.median).padStart(12)} ${(`${gain.toFixed(2)}x`).padStart(12)} ${helps.padStart(10)}`,
				);
			}

			console.log(`${"═".repeat(80)}\n`);
		});
	}
});
