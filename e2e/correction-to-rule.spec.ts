import { expect, test } from "@playwright/test";

import { seededCategoryId } from "@/lib/domain/seeded-ids";
import { buildLedgerFixture, FIXED_NOW, USER_ID } from "./fixtures/ledger";
import { seedIndexedDb } from "./seed-indexeddb";

const READ_PAYEE = "MTNMOBILEMONEY";
const FIXED_PAYEE = "MTN airtime";

function snapshot(payee: string, categoryId: string) {
  return {
    accountId: "account:momo",
    occurredOn: "2026-04-08",
    originalAmount: 5_000,
    currency: "UGX" as const,
    normalizedAmount: 5_000,
    type: "expense" as const,
    categoryId,
    payee,
    note: "",
    confidenceScore: 0.6,
    issues: [],
    fieldWarnings: [],
  };
}

test("a correction can be turned into a rule that does it next time", async ({ page }) => {
  const fixture = buildLedgerFixture();
  const airtime = seededCategoryId(USER_ID, "Airtime");
  const food = seededCategoryId(USER_ID, "Food");

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, {
    ...fixture,
    correctionLogs: [
      {
        id: "correction:e2e",
        userId: USER_ID,
        reviewItemId: "review:e2e",
        envelopeId: "envelope:e2e",
        source: "sms",
        parserLabel: "MTN MoMo",
        confidenceScore: 0.6,
        originalSnapshot: snapshot(READ_PAYEE, food),
        approvedSnapshot: snapshot(FIXED_PAYEE, airtime),
        createdAt: "2026-04-08T10:00:00.000Z",
      },
    ],
  });
  await page.goto("/settings/rules");
  await page.waitForTimeout(1500);

  await expect(page.getByText(`You renamed ${READ_PAYEE} to ${FIXED_PAYEE}.`)).toBeVisible();
  await expect(page.getByText("You moved it from Food to Airtime.")).toBeVisible();

  await page.getByRole("button", { name: "Do this for me next time" }).click();

  await expect(page.getByText(`Fix ${READ_PAYEE}`)).toBeVisible();

  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByText(`Fix ${READ_PAYEE}`)).toBeVisible();
});
