import { describe, expect, it } from "vitest";

import { getMonthlyInsights, insightRuleCount, type InsightContext } from "@/lib/domain/insights";
import { getSummaryForTransactions } from "@/lib/domain/summaries";
import { SEEDED_SLUGS, feesCategoryId } from "@/lib/domain/seeded-ids";
import { deriveSeededId } from "@/lib/ids";
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
    counterparties: [],
    trackedPayees: [],
    items: [],
    lineItems: [],
    today: "2026-08-20",
    allTransactions: transactions,
    now: new Date("2026-08-20T00:00:00.000Z"),
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

describe("money owed to you that has gone quiet", () => {
  const lendingPool = {
    id: deriveSeededId(USER, SEEDED_SLUGS.lendingPool),
    userId: USER,
    name: "Money lent out",
    type: "receivable" as const,
    openingBalance: 0,
    balance: 250_000,
    isArchived: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  };

  const grace = {
    id: "counterparty:grace",
    userId: USER,
    name: "Auntie Grace",
    kind: "borrower" as const,
    isArchived: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  };

  const lent = transaction({
    id: "lent",
    accountId: lendingPool.id,
    type: "transfer",
    amount: 250_000,
    categoryId: "cat:lending",
    counterpartyId: grace.id,
    occurredOn: "2026-05-20",
    transferGroupId: "g:lend",
  });

  it("names who owes what, and how long it has been quiet", () => {
    const insight = getMonthlyInsights(
      context({
        transactions: [],
        allTransactions: [lent],
        accounts: [lendingPool],
        counterparties: [grace],
      }),
    ).find((entry) => entry.id === "insight:idle-lending");

    expect(insight?.title).toContain("Auntie Grace still owes you");
    expect(insight?.title).toContain("250,000");
    expect(insight?.body).toMatch(/\d+ days/);
    expect(insight?.href).toBe("/debt");
  });

  it("treats an overdue loan as more urgent than a quiet one", () => {
    const overdue = getMonthlyInsights(
      context({
        transactions: [],
        allTransactions: [{ ...lent, expectedRepaymentDate: "2026-06-30" }],
        accounts: [lendingPool],
        counterparties: [grace],
      }),
    ).find((entry) => entry.id === "insight:idle-lending");

    expect(overdue?.priority).toBe(1);
    expect(overdue?.body).toContain("2026-06-30");
  });

  it("says nothing when nothing is outstanding", () => {
    expect(
      getMonthlyInsights(context({ transactions: [], allTransactions: [] })).find(
        (entry) => entry.id === "insight:idle-lending",
      ),
    ).toBeUndefined();
  });

  it("reads all history, not just the period, since a loan outlives a month", () => {
    const insight = getMonthlyInsights(
      context({
        transactions: [],
        allTransactions: [lent],
        accounts: [lendingPool],
        counterparties: [grace],
      }),
    ).find((entry) => entry.id === "insight:idle-lending");

    expect(insight, "an older loan disappeared because only the period was read").toBeDefined();
  });
});

describe("records against the balance a message stated", () => {
  const stated = (id: string, day: string, amount: number, statedBalance?: number) =>
    transaction({ id, amount, occurredOn: day, statedBalance, accountId: "acc:Momo" });

  it("reports the account that does not add up, and both figures", () => {
    const insight = getMonthlyInsights(
      context({
        transactions: [],
        allTransactions: [
          stated("a", "2026-08-01", 1_000, 50_000),
          stated("b", "2026-08-02", 1_000, 40_000),
        ],
      }),
    ).find((entry) => entry.id === "insight:balance-gap");

    expect(insight?.title).toContain("Momo is");
    expect(insight?.title).toContain("9,000");
    expect(insight?.body).toContain("40,000");
    expect(insight?.body).toContain("49,000");
  });

  it("ignores a gap too small to chase", () => {
    expect(
      getMonthlyInsights(
        context({
          transactions: [],
          allTransactions: [
            stated("a", "2026-08-01", 1_000, 50_000),
            stated("b", "2026-08-02", 1_000, 48_900),
          ],
        }),
      ).find((entry) => entry.id === "insight:balance-gap"),
    ).toBeUndefined();
  });

  it("stays quiet when the records agree with the messages", () => {
    expect(
      getMonthlyInsights(
        context({
          transactions: [],
          allTransactions: [
            stated("a", "2026-08-01", 1_000, 50_000),
            stated("b", "2026-08-02", 1_000, 49_000),
          ],
        }),
      ).find((entry) => entry.id === "insight:balance-gap"),
    ).toBeUndefined();
  });
});

describe("a bill that repeats but is not tracked", () => {
  const rent = ["2026-06-01", "2026-07-01", "2026-08-01"].map((occurredOn, index) =>
    transaction({
      id: `rent:${index}`,
      occurredOn,
      amount: 1_500_000,
      categoryId: "cat:rent",
      payee: "Landlord",
    }),
  );

  it("names it, its usual amount and the day it lands", () => {
    const insight = getMonthlyInsights(
      context({ transactions: [], allTransactions: rent }),
    ).find((entry) => entry.id === "insight:untracked-bill");

    expect(insight?.title).toContain("Landlord looks monthly at");
    expect(insight?.title).toContain("1,500,000");
    expect(insight?.body).toContain("3 months");
    expect(insight?.body).toContain("1st");
    expect(insight?.href).toBe("/recurring");
  });

  it("goes quiet once the bill is tracked", () => {
    expect(
      getMonthlyInsights(
        context({ transactions: [], allTransactions: rent, trackedPayees: ["Landlord"] }),
      ).find((entry) => entry.id === "insight:untracked-bill"),
    ).toBeUndefined();
  });
});

describe("an item that costs more than it has", () => {
  const sugar = {
    id: "item:sugar",
    userId: USER,
    name: "Sugar",
    normalizedName: "sugar",
    isArchived: false,
    createdAt: STAMP,
    updatedAt: STAMP,
  };

  const shops = [
    transaction({ id: "shop:1", occurredOn: "2026-06-10", payee: "Market", amount: 20_000 }),
    transaction({ id: "shop:2", occurredOn: "2026-08-10", payee: "Kiosk", amount: 20_000 }),
  ];

  const lineItems = [
    {
      id: "line:1",
      userId: USER,
      transactionId: "shop:1",
      itemId: sugar.id,
      label: "Sugar",
      quantity: 1,
      unitPrice: 5_500,
      amount: 5_500,
      createdAt: STAMP,
      updatedAt: STAMP,
    },
    {
      id: "line:2",
      userId: USER,
      transactionId: "shop:2",
      itemId: sugar.id,
      label: "Sugar",
      quantity: 1,
      unitPrice: 6_200,
      amount: 6_200,
      createdAt: STAMP,
      updatedAt: STAMP,
    },
  ];

  it("names the item, both prices and where each was paid", () => {
    const insight = getMonthlyInsights(
      context({
        transactions: [],
        allTransactions: shops,
        items: [sugar],
        lineItems,
      }),
    ).find((entry) => entry.id === "insight:price-rise");

    expect(insight?.title).toContain("Sugar costs");
    expect(insight?.title).toContain("700");
    expect(insight?.body).toContain("Kiosk");
    expect(insight?.body).toContain("Market");
    expect(insight?.href).toBe("/shopping");
  });

  it("stays quiet when nothing has been itemised", () => {
    expect(
      getMonthlyInsights(context({ transactions: [], allTransactions: shops })).find(
        (entry) => entry.id === "insight:price-rise",
      ),
    ).toBeUndefined();
  });

  it("ignores a rise too small to notice", () => {
    const insight = getMonthlyInsights(
      context({
        transactions: [],
        allTransactions: shops,
        items: [sugar],
        lineItems: [lineItems[0], { ...lineItems[1], unitPrice: 5_600, amount: 5_600 }],
      }),
    ).find((entry) => entry.id === "insight:price-rise");

    expect(insight).toBeUndefined();
  });
});
