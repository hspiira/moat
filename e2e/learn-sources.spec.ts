import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

test("the sources page shows its sources even when nothing was seeded", async ({ page }) => {
  await openSeededApp(page, "/learn");

  await expect(page.getByText("Bank of Uganda bills and bonds calendar")).toBeVisible();
  const sourceCount = page.getByText("Sources", { exact: true }).locator("..");
  await expect(sourceCount).toBeVisible();
  await expect(sourceCount).not.toHaveText(/\b0\b/);
});
