import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

const CARD = "Who took it, and who paid you";

test("a payee can be named, and the name sticks", async ({ page }) => {
  await openSeededApp(page, "/report");

  const card = page.locator("[data-slot='card']").filter({ hasText: CARD });
  const bodaRow = card.getByRole("listitem").filter({ hasText: "Boda Rider" });

  await bodaRow.getByRole("button", { name: "Name this party" }).click();

  // The text as it stands is offered, so there is something to correct.
  await expect(page.locator("#party-name")).toHaveValue("Boda Rider");
  await page.locator("#party-name").fill("Ssenga Boda");
  await page.getByRole("button", { name: "Save name" }).click();
  await page.waitForTimeout(1500);

  const namedRow = card.getByRole("listitem").filter({ hasText: "Ssenga Boda" });
  await expect(namedRow).toBeVisible();

  // Named parties are not asked to be named again.
  await expect(namedRow.getByRole("button", { name: "Name this party" })).toHaveCount(0);

  await page.reload();
  await page.waitForTimeout(1500);
  await expect(
    page.locator("[data-slot='card']").filter({ hasText: CARD }),
  ).toContainText("Ssenga Boda");
});
