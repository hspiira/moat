import { expect, test } from "@playwright/test";

import { seededCategoryId } from "@/lib/domain/seeded-ids";
import { ACCOUNTS, buildLedgerFixture, FIXED_NOW, USER_ID } from "./fixtures/ledger";
import { seedIndexedDb } from "./seed-indexeddb";

const READ_PAYEE = "MTNMOBILEMONEY";
const FIXED_PAYEE = "MTN airtime";

test("approving a fix offers to do it for you next time", async ({ page }) => {
  const fixture = buildLedgerFixture();
  const airtime = seededCategoryId(USER_ID, "Airtime");
  const food = seededCategoryId(USER_ID, "Food");
  const accountId = ACCOUNTS.momo.id;

  // Seeded as already corrected by hand: the item carries the owner's values
  // while originalSnapshot keeps what the parser read.
  const shared = {
    accountId,
    occurredOn: "2026-04-08",
    originalAmount: 5_000,
    currency: "UGX" as const,
    normalizedAmount: 5_000,
    type: "expense" as const,
    note: "",
    confidenceScore: 0.8,
    issues: [],
    fieldWarnings: [],
  };

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, {
    ...fixture,
    captureReviewItems: [
      {
        ...shared,
        id: "review:e2e",
        userId: USER_ID,
        envelopeId: "envelope:e2e",
        source: "sms",
        categoryId: airtime,
        payee: FIXED_PAYEE,
        messageHash: "hash:e2e",
        parserLabel: "MTN MoMo",
        status: "new",
        originalSnapshot: { ...shared, categoryId: food, payee: READ_PAYEE },
        createdAt: "2026-04-08T09:00:00.000Z",
        updatedAt: "2026-04-08T09:00:00.000Z",
      },
    ],
  });
  await page.goto("/inbox");
  await page.waitForTimeout(1500);

  await page.getByText(FIXED_PAYEE).first().click();
  await page.getByRole("button", { name: "Approve to ledger" }).click();
  await page.waitForTimeout(1500);

  const banner = page.getByText(`Next time a message says`);
  await expect(banner).toBeVisible();
  await expect(page.getByText(`call it ${FIXED_PAYEE} and file it under Airtime`)).toBeVisible();

  await page.getByRole("button", { name: "Yes, do this for me" }).click();
  await expect(banner).toHaveCount(0);

  await page.goto("/settings/rules");
  await page.waitForTimeout(1500);
  await expect(page.getByText(`Fix ${READ_PAYEE}`)).toBeVisible();
});
