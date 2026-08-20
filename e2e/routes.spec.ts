import { expect, test } from "@playwright/test";

import { expectNoSidewaysScroll, openSeededApp } from "./harness";

const DESTINATIONS = [
  { path: "/inbox", heading: /Capture review/i },
  { path: "/month", heading: /Month check/i },
  { path: "/import", heading: /Import/i },
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
  { from: "/transactions/import", to: "/import" },
  { from: "/transactions/tools", to: "/settings/rules" },
  { from: "/investment-compass", to: "/goals" },
];

for (const { from, to } of MOVED) {
  test(`${from} still lands on ${to}`, async ({ page }) => {
    await openSeededApp(page, from);
    await expect(page).toHaveURL(new RegExp(`${to}$`));
  });
}
