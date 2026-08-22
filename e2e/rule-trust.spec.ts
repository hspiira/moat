import { expect, test } from "@playwright/test";

import { ACCOUNTS, buildLedgerFixture, FIXED_NOW, USER_ID } from "./fixtures/ledger";
import { seededCategoryId } from "@/lib/domain/seeded-ids";
import { seedIndexedDb } from "./seed-indexeddb";

const READ_PAYEE = "MTNMOBILEMONEY";
const FIXED_PAYEE = "MTN airtime";
const RULE_NAME = "Fix MTNMOBILEMONEY";

function reviewItem(id: string, airtime: string) {
  const shared = {
    accountId: ACCOUNTS.momo.id,
    occurredOn: "2026-04-08",
    originalAmount: 5_000,
    currency: "UGX" as const,
    normalizedAmount: 5_000,
    type: "expense" as const,
    note: "",
    confidenceScore: 0.9,
    issues: [],
    fieldWarnings: [],
  };

  // Left as the parser read it, so the rule is doing its job rather than
  // overriding anything the owner put right.
  return {
    ...shared,
    id,
    userId: USER_ID,
    envelopeId: "envelope:e2e",
    source: "sms" as const,
    categoryId: airtime,
    payee: READ_PAYEE,
    messageHash: `hash:${id}`,
    parserLabel: "MTN MoMo",
    status: "new" as const,
    originalSnapshot: { ...shared, categoryId: airtime, payee: READ_PAYEE },
    createdAt: "2026-04-08T09:00:00.000Z",
    updatedAt: "2026-04-08T09:00:00.000Z",
  };
}

test("a rule that keeps agreeing is offered the job of filing on its own", async ({ page }) => {
  const fixture = buildLedgerFixture();
  const airtime = seededCategoryId(USER_ID, "Airtime");

  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  await seedIndexedDb(page, {
    ...fixture,
    transactionRules: [
      {
        id: "rule:e2e",
        userId: USER_ID,
        name: RULE_NAME,
        enabled: true,
        priority: 100,
        source: "sms",
        payeePattern: READ_PAYEE,
        effectPayee: FIXED_PAYEE,
        autoMarkReviewed: false,
        // Four agreements already behind it, so one more earns the offer.
        timesAccepted: 4,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    captureReviewItems: [reviewItem("review:e2e", airtime)],
  });
  await page.goto("/inbox");
  await page.waitForTimeout(1500);

  await page.getByText(READ_PAYEE).first().click();
  await page.getByRole("button", { name: "Approve to ledger" }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText("has agreed with you 5 times running")).toBeVisible();
  await page.getByRole("button", { name: "Yes, let it file these" }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText("has agreed with you 5 times running")).toHaveCount(0);

  await page.goto("/settings/rules");
  await page.waitForTimeout(1500);
  await expect(page.getByText(RULE_NAME)).toBeVisible();
});
