import { describe, expect, it } from "vitest";

import { getMonthlyInsights, insightRuleCount, type InsightContext } from "@/lib/domain/insights";
import { getSummaryForTransactions } from "@/lib/domain/summaries";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import type { Account, Category, Transaction } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-08-01T00:00:00.000Z";

const categories: Category[] = [
  { id: "cat:rent", userId: USER, name: "Rent", kind: "expense", isDefault: true, createdAt: STAMP },
  { id: "cat:boda", userId: USER, name: "Transport / boda", kind: "expense", isDefault: true, createdAt: STAMP },
  { id: "cat:food", userId: USER, name: "Food", kind: "expense", isDefault: true, createdAt: STAMP },
  { id: "cat:salary", userId: USER, name: "Salary", kind: "income", isDefault: true, createdAt: STAMP },
  { id: feesCategoryId(USER), userId: USER, name: "Fees & charges", kind: "expense", isDefault: true, createdAt: STAMP },
];

const account = (name: string, balance: number): Account => ({
  id: `acc:${name}`,
  userId: USER,
  name,
  type: "mobile_money",
  openingBalance: balance,
  balance,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
});

function transaction(values: Partial<Transaction> & { id: string }): Transaction {
  return {
    userId: USER,
    accountId: "acc:Momo",
    type: "expense",
    amount: 10_000,
    currency: "UGX",
    originalAmount: 10_000,
    occurredOn: "2026-08-05",
    categoryId: "cat:boda",
    reconciliationState: "posted",
    source: "sms",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...values,
  };
}

function context(overrides: Partial<InsightContext> = {}): InsightContext {
  const transactions = overrides.transactions ?? [];
  return {
    transactions,
    previousTransactions: [],
    categories,
    accounts: [account("Momo", 100_000)],
    projects: [],
    periodLabel: "month",
    summary: getSummaryForTransactions(transactions, categories),
    ...overrides,
  };
}

const boda = (index: number, amount: number, day = 5) =>
  transaction({ id: `boda:${index}`, amount, occurredOn: `2026-08-0${day}` });

describe("every insight carries a number", () => {
  it("puts a figure in the title of whatever it produces", () => {
    const transactions = [
      transaction({ id: "rent", amount: 3_000_000, categoryId: "cat:rent" }),
      transaction({ id: "pay", amount: 900_000, type: "income", categoryId: "cat:salary" }),
      ...Array.from({ length: 6 }, (_, index) => boda(index, 9_000)),
      transaction({ id: "fee1", amount: 1_725, feeParentId: "rent" }),
      transaction({ id: "fee2", amount: 500, categoryId: feesCategoryId(USER) }),
    ];
    const previous = [
      transaction({ id: "p:rent", amount: 1_000_000, categoryId: "cat:rent" }),
      ...Array.from({ length: 5 }, (_, index) => boda(100 + index, 7_000)),
    ];

    const insights = getMonthlyInsights(
      context({ transactions, previousTransactions: previous }),
    );

    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.title, `"${insight.title}" states no number`).toMatch(/\d/);
      expect(insight.href, `"${insight.title}" offers nowhere to act`).toBeTruthy();
    }
  });

  it("says nothing at all rather than something empty", () => {
    expect(getMonthlyInsights(context())).toEqual([]);
  });

  it("never floods the page", () => {
    const transactions = [
      transaction({ id: "rent", amount: 3_000_000, categoryId: "cat:rent" }),
      transaction({ id: "pay", amount: 100, type: "income", categoryId: "cat:salary" }),
      ...Array.from({ length: 6 }, (_, index) => boda(index, 9_000)),
      transaction({ id: "fee1", amount: 5_000, feeParentId: "rent" }),
    ];
    const insights = getMonthlyInsights(
      context({
        transactions,
        previousTransactions: [transaction({ id: "p:rent", amount: 500_000, categoryId: "cat:rent" })],
        accounts: [account("Momo", -12_000)],
      }),
    );

    expect(insights.length).toBeLessThanOrEqual(4);
    expect(insightRuleCount).toBeGreaterThan(4);
  });
});

describe("fee load insight", () => {
  it("reports what charges cost and what share that is", () => {
    const transactions = [
      transaction({ id: "send", amount: 200_000 }),
      transaction({ id: "fee", amount: 1_725, feeParentId: "send" }),
    ];
    const insight = getMonthlyInsights(context({ transactions })).find(
      (entry) => entry.id === "insight:fees",
    );

    expect(insight?.title).toContain("1,725");
    expect(insight?.body).toContain("200,000");
  });

  it("stays quiet about trivial charges", () => {
    const transactions = [
      transaction({ id: "send", amount: 200_000 }),
      transaction({ id: "fee", amount: 200, feeParentId: "send" }),
    ];

    expect(
      getMonthlyInsights(context({ transactions })).find((entry) => entry.id === "insight:fees"),
    ).toBeUndefined();
  });
});

describe("unit cost insight", () => {
  it("turns a total into a price per time", () => {
    const transactions = Array.from({ length: 6 }, (_, index) => boda(index, 9_000));
    const insight = getMonthlyInsights(context({ transactions })).find(
      (entry) => entry.id === "insight:unit-cost",
    );

    expect(insight?.title).toContain("9,000");
    expect(insight?.body).toContain("6 times");
  });

  it("needs enough repeats to be a habit rather than an event", () => {
    const transactions = Array.from({ length: 3 }, (_, index) => boda(index, 9_000));

    expect(
      getMonthlyInsights(context({ transactions })).find(
        (entry) => entry.id === "insight:unit-cost",
      ),
    ).toBeUndefined();
  });
});

describe("concentration insight", () => {
  it("names a category that dominates", () => {
    const transactions = [
      transaction({ id: "rent", amount: 3_000_000, categoryId: "cat:rent" }),
      boda(1, 100_000),
    ];
    const insight = getMonthlyInsights(context({ transactions })).find(
      (entry) => entry.id === "insight:concentration",
    );

    expect(insight?.title).toContain("Rent is 97%");
  });

  it("stays quiet when spending is spread out", () => {
    const transactions = [
      transaction({ id: "rent", amount: 100_000, categoryId: "cat:rent" }),
      boda(1, 100_000),
      transaction({ id: "food", amount: 100_000, categoryId: "cat:food" }),
    ];

    expect(
      getMonthlyInsights(context({ transactions })).find(
        (entry) => entry.id === "insight:concentration",
      ),
    ).toBeUndefined();
  });
});

describe("movement insight", () => {
  it("compares a category against the period before", () => {
    const insight = getMonthlyInsights(
      context({
        transactions: [transaction({ id: "rent", amount: 300_000, categoryId: "cat:rent" })],
        previousTransactions: [transaction({ id: "p", amount: 100_000, categoryId: "cat:rent" })],
      }),
    ).find((entry) => entry.id === "insight:movement");

    expect(insight?.title).toContain("up 200%");
    expect(insight?.body).toContain("100,000");
  });

  it("ignores a category that is new, having nothing to compare with", () => {
    expect(
      getMonthlyInsights(
        context({
          transactions: [transaction({ id: "rent", amount: 300_000, categoryId: "cat:rent" })],
        }),
      ).find((entry) => entry.id === "insight:movement"),
    ).toBeUndefined();
  });

  it("ignores small change even when the percentage is large", () => {
    expect(
      getMonthlyInsights(
        context({
          transactions: [transaction({ id: "a", amount: 900, categoryId: "cat:rent" })],
          previousTransactions: [transaction({ id: "b", amount: 100, categoryId: "cat:rent" })],
        }),
      ).find((entry) => entry.id === "insight:movement"),
    ).toBeUndefined();
  });
});

describe("a project explains a spike", () => {
  const relocation = {
    id: "project:relocation",
    userId: USER,
    name: "Relocation",
    startedOn: "2026-06-01",
    isArchived: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  };

  const spike = {
    transactions: [
      transaction({ id: "rent", amount: 3_000_000, categoryId: "cat:rent", projectId: relocation.id }),
    ],
    previousTransactions: [transaction({ id: "p", amount: 1_000_000, categoryId: "cat:rent" })],
  };

  it("names the project behind the rise", () => {
    const insight = getMonthlyInsights(
      context({ ...spike, projects: [relocation] }),
    ).find((entry) => entry.id === "insight:movement");

    expect(insight?.title).toContain("up 200%");
    expect(insight?.body).toContain("tagged Relocation");
    expect(insight?.href).toBe("/projects");
  });

  it("treats an explained rise as less urgent than an unexplained one", () => {
    const explained = getMonthlyInsights(
      context({ ...spike, projects: [relocation] }),
    ).find((entry) => entry.id === "insight:movement");
    const bare = getMonthlyInsights(
      context({
        transactions: [transaction({ id: "rent", amount: 3_000_000, categoryId: "cat:rent" })],
        previousTransactions: spike.previousTransactions,
      }),
    ).find((entry) => entry.id === "insight:movement");

    expect(explained?.priority).toBeGreaterThan(bare!.priority);
  });

  it("says nothing about a project when the spending carries none", () => {
    const insight = getMonthlyInsights(
      context({
        transactions: [transaction({ id: "rent", amount: 3_000_000, categoryId: "cat:rent" })],
        previousTransactions: spike.previousTransactions,
        projects: [relocation],
      }),
    ).find((entry) => entry.id === "insight:movement");

    expect(insight?.body).not.toContain("tagged");
  });
});
