import { describe, expect, it } from "vitest";

import {
  derivePriceObservations,
  summarizeItemPrices,
} from "@/lib/domain/price-observations";
import type { PriceObservation, Transaction, TransactionLineItem } from "@/lib/types";

const now = "2026-08-07T00:00:00.000Z";

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "transaction:t1",
    userId: "user-1",
    accountId: "account-1",
    type: "expense",
    amount: 60000,
    currency: "UGX",
    originalAmount: 60000,
    occurredOn: "2026-08-01",
    categoryId: "category-food",
    reconciliationState: "posted",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function line(overrides: Partial<TransactionLineItem>): TransactionLineItem {
  return {
    id: `line:${crypto.randomUUID()}`,
    userId: "user-1",
    transactionId: "transaction:t1",
    itemId: "item:sugar",
    label: "Sugar",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("derivePriceObservations", () => {
  it("joins line items with their transaction and skips itemless lines", () => {
    const transactions = [transaction({ payee: "Mega Standard" })];
    const lines = [
      line({ unitPrice: 3500, quantity: 1 }),
      line({ itemId: undefined, label: "misc" }),
    ];
    const observations = derivePriceObservations(lines, transactions);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      itemId: "item:sugar",
      merchant: "Mega Standard",
      occurredOn: "2026-08-01",
      unitPrice: 3500,
    });
  });

  it("skips lines whose transaction is missing and defaults merchant", () => {
    const observations = derivePriceObservations(
      [line({}), line({ transactionId: "transaction:gone" })],
      [transaction({ payee: undefined })],
    );
    expect(observations).toHaveLength(1);
    expect(observations[0].merchant).toBe("Unknown");
  });
});

describe("summarizeItemPrices", () => {
  const base: PriceObservation = {
    itemId: "item:sugar",
    transactionId: "transaction:t1",
    lineItemId: "line:1",
    merchant: "Mega Standard",
    occurredOn: "2026-08-01",
    unitPrice: 3500,
  };

  it("picks the latest as lastPaid and the cheapest recent as bestRecent", () => {
    const observations: PriceObservation[] = [
      base,
      { ...base, lineItemId: "line:2", occurredOn: "2026-06-10", merchant: "Owino", unitPrice: 2800 },
      { ...base, lineItemId: "line:3", occurredOn: "2024-01-01", merchant: "Old", unitPrice: 100 },
    ];
    const summary = summarizeItemPrices(observations, "2026-08-07").get("item:sugar");
    expect(summary?.lastPaid?.merchant).toBe("Mega Standard");
    expect(summary?.bestRecent?.merchant).toBe("Owino");
    expect(summary?.observationCount).toBe(3);
  });

  it("falls back to amount when no unit prices exist in the window", () => {
    const observations: PriceObservation[] = [
      { ...base, unitPrice: undefined, amount: 12000 },
      { ...base, lineItemId: "line:2", occurredOn: "2026-07-01", unitPrice: undefined, amount: 9000, merchant: "Kalerwe" },
    ];
    const summary = summarizeItemPrices(observations, "2026-08-07").get("item:sugar");
    expect(summary?.bestRecent?.merchant).toBe("Kalerwe");
  });

  it("compares an amount-only observation on a per-unit basis, not the line total", () => {
    const observations: PriceObservation[] = [
      { ...base, lineItemId: "line:1", occurredOn: "2026-08-01", unitPrice: 3500, merchant: "Mega Standard" },
      {
        ...base,
        lineItemId: "line:2",
        occurredOn: "2026-07-15",
        unitPrice: undefined,
        amount: 7000,
        quantity: 2,
        merchant: "Owino",
      },
    ];
    const summary = summarizeItemPrices(observations, "2026-08-07").get("item:sugar");
    expect(summary?.bestRecent?.merchant).toBe("Mega Standard");

    const beatingObservations: PriceObservation[] = [
      { ...base, lineItemId: "line:1", occurredOn: "2026-08-01", unitPrice: 3500, merchant: "Mega Standard" },
      {
        ...base,
        lineItemId: "line:2",
        occurredOn: "2026-07-15",
        unitPrice: undefined,
        amount: 6000,
        quantity: 2,
        merchant: "Owino",
      },
    ];
    const beatingSummary = summarizeItemPrices(beatingObservations, "2026-08-07").get(
      "item:sugar",
    );
    expect(beatingSummary?.bestRecent?.merchant).toBe("Owino");
  });
});
