import { expect, test } from "@playwright/test";

import { expectNoSidewaysScroll, openSeededApp } from "./harness";

const DESTINATIONS = [
  { path: "/inbox", heading: /Capture review/i },
  { path: "/month", heading: /Month check/i },
  { path: "/settings/rules", heading: /Rules/i },
  { path: "/settings/categories", heading: /Categories/i },
];

for (const { path, heading } of DESTINATIONS) {
  test(`${path} opens and fits the screen`, async ({ page }) => {
    const { errors } = await openSeededApp(page, path);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(errors).toEqual([]);
  });
}

const MOVED = [
  { from: "/transactions/review", to: "/inbox" },
  { from: "/transactions/review/month-close", to: "/month" },
  // Both old import routes now land on the capture page, which owns all
  // three ways of bringing transactions in.
  { from: "/transactions/import", to: "/transactions/capture" },
  { from: "/import", to: "/transactions/capture" },
  { from: "/budgets", to: "/plan" },
  { from: "/recurring", to: "/plan" },
  { from: "/transactions/tools", to: "/settings/rules" },
  { from: "/investment-compass", to: "/goals" },
];

for (const { from, to } of MOVED) {
  test(`${from} still lands on ${to}`, async ({ page }) => {
    await openSeededApp(page, from);
    // A destination may carry a query, so the path is what is asserted.
    await expect(page).toHaveURL(new RegExp(`${to}(\\?.*)?$`));
  });
}
