import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

// A form belongs behind an action button, not sitting open on arrival. Search
// boxes are exempt because they filter what is already on the page rather than
// record anything. These two are the pages a button sends you to, so the form
// is the point of arriving. Onboarding is in neither list: it is a wizard, and
// its first step has nothing to fill in.
const FORM_IS_THE_PAGE = ["/transactions/capture"];

const ROUTES = [
  "/",
  "/accounts",
  "/transactions",
  "/month",
  "/plan",
  "/report",
  "/projects",
  "/goals",
  "/shopping",
  "/debt",
  "/inbox",
  "/settings",
  "/settings/rules",
  "/settings/categories",
  "/learn",
];

for (const route of ROUTES) {
  test(`${route} opens without a form on it`, async ({ page }) => {
    await openSeededApp(page, route);

    const openFields = page.locator(
      "input:visible:not([type='search']):not([type='checkbox']):not([type='radio']), textarea:visible",
    );

    await expect(openFields, `${route} shows a form field before any button is pressed`).toHaveCount(
      0,
    );
  });
}

test("the pages whose job is one form still show it", async ({ page }) => {
  for (const route of FORM_IS_THE_PAGE) {
    await openSeededApp(page, route);
    await expect(page.locator("input:visible, textarea:visible").first()).toBeVisible();
  }
});
