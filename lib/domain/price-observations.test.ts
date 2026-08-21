import { describe, expect, it } from "vitest";

import { findPriceRises } from "@/lib/domain/price-observations";
import type { Item, Transaction, TransactionLineItem } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-08-01T00:00:00.000Z";
const TODAY = "2026-08-20";

const sugar: Item = {
  id: "item:sugar",
  userId: USER,
  name: "Sugar",
  normalizedName: "sugar",
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
};

function shop(id: string, occurredOn: string): Transaction {
  return {
    id,
    userId: USER,
    accountId: "acc:momo",
    type: "expense",
    amount: 20_000,
    currency: "UGX",
    originalAmount: 20_000,
    occurredOn,
    categoryId: "cat:food",
    reconciliationState: "posted",
    source: "manual",
    payee: "Market",
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

function line(id: string, transactionId: string, unitPrice: number): TransactionLineItem {
  return {
    id,
    userId: USER,
    transactionId,
    itemId: sugar.id,
    label: "Sugar",
    quantity: 1,
    unitPrice,
    amount: unitPrice,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

describe("findPriceRises", () => {
  it("reports what an item costs now against the cheapest it has been", () => {
    const [rise] = findPriceRises({
      items: [sugar],
      transactions: [shop("t1", "2026-06-10"), shop("t2", "2026-08-10")],
      lineItems: [line("l1", "t1", 5_500), line("l2", "t2", 6_200)],
      today: TODAY,
    });

    expect(rise.name).toBe("Sugar");
    expect(rise.paidBefore).toBe(5_500);
    expect(rise.paidNow).toBe(6_200);
    expect(rise.rise).toBe(700);
  });

  it("says nothing when the latest price is the cheapest", () => {
    expect(
      findPriceRises({
        items: [sugar],
        transactions: [shop("t1", "2026-06-10"), shop("t2", "2026-08-10")],
        lineItems: [line("l1", "t1", 6_200), line("l2", "t2", 5_500)],
        today: TODAY,
      }),
    ).toEqual([]);
  });

  it("says nothing about an item bought only once", () => {
    expect(
      findPriceRises({
        items: [sugar],
        transactions: [shop("t1", "2026-06-10")],
        lineItems: [line("l1", "t1", 5_500)],
        today: TODAY,
      }),
    ).toEqual([]);
  });

  it("catches a price that crept up rather than jumped", () => {
    const [rise] = findPriceRises({
      items: [sugar],
      transactions: [
        shop("t1", "2026-06-10"),
        shop("t2", "2026-07-10"),
        shop("t3", "2026-08-10"),
      ],
      lineItems: [line("l1", "t1", 5_000), line("l2", "t2", 5_400), line("l3", "t3", 5_800)],
      today: TODAY,
    });

    expect(rise.rise, "comparing only against the previous shop hides a creep").toBe(800);
  });

  it("falls back to amount over quantity when no unit price was recorded", () => {
    const [rise] = findPriceRises({
      items: [sugar],
      transactions: [shop("t1", "2026-06-10"), shop("t2", "2026-08-10")],
      lineItems: [
        { ...line("l1", "t1", 0), unitPrice: undefined, quantity: 2, amount: 10_000 },
        { ...line("l2", "t2", 0), unitPrice: undefined, quantity: 2, amount: 13_000 },
      ],
      today: TODAY,
    });

    expect(rise.paidBefore).toBe(5_000);
    expect(rise.paidNow).toBe(6_500);
  });

  it("puts the biggest rise first", () => {
    const flour: Item = { ...sugar, id: "item:flour", name: "Flour", normalizedName: "flour" };
    const rises = findPriceRises({
      items: [sugar, flour],
      transactions: [shop("t1", "2026-06-10"), shop("t2", "2026-08-10")],
      lineItems: [
        line("l1", "t1", 5_500),
        line("l2", "t2", 6_200),
        { ...line("l3", "t1", 3_000), itemId: flour.id, label: "Flour" },
        { ...line("l4", "t2", 8_000), itemId: flour.id, label: "Flour" },
      ],
      today: TODAY,
    });

    expect(rises.map((entry) => entry.name)).toEqual(["Flour", "Sugar"]);
  });
});
