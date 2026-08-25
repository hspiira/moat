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
