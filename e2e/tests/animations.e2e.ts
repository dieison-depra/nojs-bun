import { expect, test } from "@playwright/test";

test.describe("Animations", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/e2e/examples/animations.html");
	});

	test("1 — Animate fadeIn: element appears functional", async ({ page }) => {
		const target = page.getByTestId("fade-target");
		await expect(target).toBeHidden();

		await page.getByTestId("fade-toggle").click();
		await expect(target).toBeVisible();
		await expect(target).toHaveText("Faded in!");
	});

	test("2 — Enter/leave logic: element is added and removed correctly", async ({
		page,
	}) => {
		const target = page.getByTestId("enterleave-target");
		await expect(target).toBeHidden();

		// Toggle on → element added
		await page.getByTestId("enterleave-toggle").click();
		await expect(target).toBeVisible();

		// Toggle off → element removed (framework waits for animation/duration)
		await page.getByTestId("enterleave-toggle").click();
		await expect(target).toBeHidden({ timeout: 5000 });
	});

	test("3 — Stagger: items have incremental animation delays", async ({
		page,
	}) => {
		const items = page.getByTestId("stagger-item");
		await expect(items).toHaveCount(4);

		for (let i = 0; i < 4; i++) {
			const delay = await items
				.nth(i)
				.evaluate(
					(el) =>
						getComputedStyle(el).animationDelay || el.style.animationDelay,
				);
			const expectedMs = i * 100;
			const expectedSec = `${expectedMs / 1000}s`;
			expect(delay).toBe(expectedMs === 0 ? "0s" : expectedSec);
		}
	});

	test("4 — Transition: element appears correctly", async ({ page }) => {
		const target = page.getByTestId("transition-target");
		await expect(target).toBeHidden();

		await page.getByTestId("transition-toggle").click();
		await expect(target).toBeVisible();
		await expect(target).toHaveText("Transitioning");
	});
});
