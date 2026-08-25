import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { openSeededApp } from "./harness";

const ROUTES = [
  "/",
  "/transactions",
  "/transactions/capture",
  "/transactions/review/capture",
  "/accounts",
  "/plan",
  "/debt",
  "/goals",
  "/inbox",
  "/learn",
  "/month",
  "/privacy",
  "/report",
  "/settings",
  "/settings/categories",
  "/settings/rules",
  "/settings/sync-conflicts",
  "/shopping",
];

const BLOCKING = new Set(["critical", "serious", "moderate"]);

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();

  return results.violations
    .filter((violation) => BLOCKING.has(violation.impact ?? ""))
    .map(
      (violation) =>
        `${violation.impact} ${violation.id} on ${violation.nodes.length}: ${violation.nodes[0]?.target?.join(" ")}`,
    );
}

for (const route of ROUTES) {
  test(`${route} has no blocking accessibility violations`, async ({ page }) => {
    await openSeededApp(page, route);
    expect(await blockingViolations(page), `${route} in light mode`).toEqual([]);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(300);
    expect(await blockingViolations(page), `${route} in dark mode`).toEqual([]);
  });
}
