import { describe, expect, it, jest } from "bun:test";
import { createSignal, createEffect, createMemo, flushSync } from "../src/signals.js";

describe("Signal System (R1)", () => {
	it("should store and retrieve value", () => {
		const s = createSignal(10);
		expect(s.get()).toBe(10);
	});

	it("should update value", () => {
		const s = createSignal(10);
		s.set(20);
		expect(s.get()).toBe(20);
	});

	it("should trigger effect on change", async () => {
		const s = createSignal(10);
		let count = 0;
		createEffect(() => {
			s.get();
			count++;
		});
		expect(count).toBe(1);
		s.set(20);
		await Promise.resolve();
		expect(count).toBe(2);
	});

	it("should handle nested effects", async () => {
		const s1 = createSignal(1);
		const s2 = createSignal(10);
		let out1 = 0;
		let out2 = 0;

		createEffect(() => {
			s1.get();
			out1++;
			createEffect(() => {
				s2.get();
				out2++;
			});
		});

		expect(out1).toBe(1);
		expect(out2).toBe(1);

		s2.set(11);
		await Promise.resolve();
		expect(out1).toBe(1);
		expect(out2).toBe(2);

		s1.set(2);
		await Promise.resolve();
		expect(out1).toBe(2);
		expect(out2).toBe(3); // New effect created, old cleaned up
	});

	it("should create memoized values", async () => {
		const s = createSignal(10);
		let calculations = 0;
		const m = createMemo(() => {
			calculations++;
			return s.get() * 2;
		});

		// Memo effect runs initially
		await Promise.resolve();
		expect(calculations).toBe(1); 
		expect(m.get()).toBe(20);
		expect(calculations).toBe(1); // Cached

		s.set(20);
		await Promise.resolve();
		expect(m.get()).toBe(40);
		expect(calculations).toBe(2);
	});

	it("should batch multiple updates (R9)", async () => {
		const s1 = createSignal(1);
		const s2 = createSignal(10);
		let runs = 0;
		createEffect(() => {
			s1.get();
			s2.get();
			runs++;
		});

		expect(runs).toBe(1);
		s1.set(2);
		s2.set(11);
		expect(runs).toBe(1); // Still 1 (batched)
		await Promise.resolve();
		expect(runs).toBe(2); // Updated once
	});

	it("should avoid diamond problem (glitch-free)", () => {
		// Note: Current implementation is synchronous and simple. 
		// Real glitch-free with topological sort would require a more complex scheduler.
		const s = createSignal(1);
		const m1 = createMemo(() => s.get() + 1);
		const m2 = createMemo(() => s.get() + 2);
		let runs = 0;
		createEffect(() => {
			m1.get();
			m2.get();
			runs++;
		});

		expect(runs).toBe(1);
		s.set(2);
		flushSync(); // drain pending effects synchronously
		expect(runs).toBe(2); // Should be 2 if glitch-free, might be more if not
	});
});
