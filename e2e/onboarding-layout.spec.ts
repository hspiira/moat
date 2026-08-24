import { expect, test } from "@playwright/test";

import { expectNoSidewaysScroll } from "./harness";

// The chooser stands in front of the form, so nothing that only loaded
// /onboarding ever rendered a single field of it.
async function openProfileStep(page: import("@playwright/test").Page) {
  // No seeded profile: onboarding is what a new owner actually meets.
  await page.goto("/onboarding");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Start fresh/ }).click();
  await expect(page.getByLabel("Your name or nickname")).toBeVisible();
}

test("the first thing a new owner sees keeps its gutter", async ({ page }) => {
  await openProfileStep(page);

  const gutter = await page.evaluate(() => {
    const offenders: string[] = [];
    document.querySelectorAll("label, input, select, button, p").forEach((element) => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      if (element.closest(".sr-only")) return;
      if (box.left < 8 || box.right > window.innerWidth - 8) {
        offenders.push(`${element.tagName} left=${Math.round(box.left)} right=${Math.round(box.right)}`);
      }
    });
    return offenders.slice(0, 6);
  });

  expect(gutter, "onboarding fields reach or pass the screen edge").toEqual([]);
  await expectNoSidewaysScroll(page);
});

test("the planning horizon is asked once, not three times", async ({ page }) => {
  await openProfileStep(page);

  // The presets answer it. The exact number and its unit only appear when the
  // presets cannot say it.
  await expect(page.getByRole("button", { name: "3 years" })).toBeVisible();
  await expect(page.getByLabel("Planning horizon")).toHaveCount(0);
  await expect(page.getByLabel("Unit")).toHaveCount(0);

  await page.getByRole("button", { name: "Something else" }).click();
  await expect(page.getByLabel("Planning horizon")).toBeVisible();
  await expect(page.getByLabel("Unit")).toBeVisible();
});
