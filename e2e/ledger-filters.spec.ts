import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

test("a link can open the ledger on a period and order", async ({ page }) => {
  await openSeededApp(page, "/transactions?days=30&sort=largest");

  await expect(page.getByRole("button", { name: "30 days" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Biggest out" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Biggest money out first", { exact: false })).toBeVisible();
});

test("narrowing the period drops what falls outside it", async ({ page }) => {
  await openSeededApp(page, "/transactions");

  const ledger = page.locator("[data-slot='card']").filter({ hasText: "Newest first" });
  const allTime = await ledger.getByRole("listitem").count();
  await page.getByRole("button", { name: "7 days" }).click();
  const lastWeek = await ledger.getByRole("listitem").count();

  expect(lastWeek).toBeLessThan(allTime);
  expect(lastWeek).toBeGreaterThan(0);
});

test("biggest out really orders by size, and skips your own transfers", async ({ page }) => {
  await openSeededApp(page, "/transactions?sort=largest");

  // Read the signed amount only. A payee parsed out of an SMS can itself hold
  // digits, so stripping everything non-numeric from the row does not work.
  const ledger = page.locator("[data-slot='card']").filter({ hasText: "Biggest money out first" });
  const amounts = await ledger.getByRole("listitem").evaluateAll((rows) =>
    rows.slice(0, 6).map((row) => {
      const match = /[-\u2212]Sh\s*([\d,]+)/.exec(row.textContent ?? "");
      return match ? Number(match[1].replace(/,/g, "")) : 0;
    }),
  );

  expect(amounts.length).toBeGreaterThan(2);
  expect([...amounts].sort((left, right) => right - left)).toEqual(amounts);

  // The fixture's largest single movement is a 150,000 transfer between the
  // owner's own accounts, which is not money gone.
  await expect(ledger.getByRole("listitem").first()).not.toContainText("Own Transfer");
});
