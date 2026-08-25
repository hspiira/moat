import { expect, test } from "@playwright/test";

import { expectNoSidewaysScroll, openSeededApp } from "./harness";

/* Every destination a person can reach, opened with real data. Routes that
   only redirect are covered in routes.spec.ts instead. */
const PAGES = [
  "/",
  "/accounts",
  "/accounts/detail",
  "/debt",
  "/goals",
  "/inbox",
  "/learn",
  "/month",
  "/plan",
  "/privacy",
  "/projects",
  "/report",
  "/settings",
  "/settings/categories",
  "/settings/rules",
  "/settings/sync-conflicts",
  "/shopping",
  "/transactions",
  "/transactions/capture",
  "/transactions/review/capture",
];

for (const route of PAGES) {
  test(`${route} opens clean`, async ({ page }) => {
    const { errors } = await openSeededApp(page, route);

    await expectNoSidewaysScroll(page);
    expect(errors, `${route} reported console or page errors`).toEqual([]);
  });
}

test("the monthly plan states its position once, not three times", async ({ page }) => {
  await openSeededApp(page, "/plan");

  // The page headline replaced the two panel headlines; three big numbers in a
  // column read as three unrelated answers to one question.
  const headlines = page.locator("p", { hasText: /^(Spoken for this month|Still to pay this month|Waiting to be given a job|Left to spend)$/ });

  await expect(headlines).toHaveCount(1);
  await expect(page.getByText("Spoken for this month")).toBeVisible();
});
