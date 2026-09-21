import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

// Period and order live behind Filters now, so the list starts at the first
// record rather than a stack of chips.
async function openFilters(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
}

async function closeFilters(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Show transactions" }).click();
  await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
}

test("a link can open the ledger on a period and order", async ({ page }) => {
  await openSeededApp(page, "/transactions?days=30&sort=largest");

  // What is in force is readable without opening anything.
  await expect(page.getByText("Last 30 days")).toBeVisible();
  await expect(page.getByText("Biggest money out first", { exact: false })).toBeVisible();

  await openFilters(page);
  await expect(page.getByRole("button", { name: "30 days" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Biggest out" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

// The ledger is an accordion now, so the rows on screen are one day's worth
// whatever the period. What the period changes is how many days there are to
// open, which is what this counts.
test("narrowing the period drops what falls outside it", async ({ page }) => {
  await openSeededApp(page, "/transactions");

  const ledger = page.locator("[data-slot='card']").filter({ hasText: "Newest first" });
  const days = ledger.getByRole("button", { name: /records/ });
  const allTime = await days.count();

  await openFilters(page);
  await page.getByRole("button", { name: "7 days" }).click();
  await closeFilters(page);

  const lastWeek = await days.count();

  expect(lastWeek).toBeLessThan(allTime);
  expect(lastWeek).toBeGreaterThan(0);
});

test("a day opens on tap and closes the one that was open", async ({ page }) => {
  await openSeededApp(page, "/transactions");

  const ledger = page.locator("[data-slot='card']").filter({ hasText: "Newest first" });
  const days = ledger.getByRole("button", { name: /records/ });

  // Today starts open; the rows on screen are its rows.
  await expect(days.first()).toHaveAttribute("aria-expanded", "true");
  await expect(days.nth(1)).toHaveAttribute("aria-expanded", "false");

  await days.nth(1).click();
  await expect(days.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(days.first()).toHaveAttribute("aria-expanded", "false");
});

// A search that hid its matches behind a closed day would not be a search.
test("searching opens every day it returns", async ({ page }) => {
  await openSeededApp(page, "/transactions");

  const ledger = page.locator("[data-slot='card']").filter({ hasText: "Newest first" });
  await page.getByLabel("Search transactions").fill("boda");

  const days = ledger.getByRole("button", { name: /records/ });
  const count = await days.count();
  expect(count).toBeGreaterThan(1);

  for (let index = 0; index < count; index += 1) {
    await expect(days.nth(index)).toHaveAttribute("aria-expanded", "true");
  }
});

test("biggest out really orders by size, and skips your own transfers", async ({ page }) => {
  await openSeededApp(page, "/transactions?sort=largest");

  // Read the signed amount only. A payee parsed out of an SMS can itself hold
  // digits, so stripping everything non-numeric from the row does not work.
  const ledger = page.locator("[data-slot='card']").filter({ hasText: "Biggest money out first" });
  const amounts = await ledger.getByRole("listitem").evaluateAll((rows) =>
    rows.slice(0, 6).map((row) => {
      const match = /[-−]Sh\s*([\d,]+)/.exec(row.textContent ?? "");
      return match ? Number(match[1].replace(/,/g, "")) : 0;
    }),
  );

  expect(amounts.length).toBeGreaterThan(2);
  expect([...amounts].sort((left, right) => right - left)).toEqual(amounts);

  // The fixture's largest single movement is a 150,000 transfer between the
  // owner's own accounts, which is not money gone.
  await expect(ledger.getByRole("listitem").first()).not.toContainText("Own Transfer");
});

test("the month summary says it is the month, not the list's period", async ({ page }) => {
  await openSeededApp(page, "/transactions?days=7");

  await expect(page.getByText("Last 7 days")).toBeVisible();
  await expect(page.getByText("This month’s summary")).toBeVisible();
});
