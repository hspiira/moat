import { describe, expect, it } from "vitest";

import type { TransactionBuildInput } from "@/components/transactions/transaction-builder";
import { createDefaultTransactionForm } from "@/components/transactions/transaction-form";
import { planTransactionWrite } from "@/lib/domain/transaction-write-plan";
import { feesCategoryId } from "@/lib/domain/seeded-ids";
import type { Account, Category } from "@/lib/types";

const USER = "user:default";

const account = (id: string, name: string, type: Account["type"] = "cash"): Account => ({
  id,
  userId: USER,
  name,
  type,
  openingBalance: 0,
  balance: 0,
  isArchived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const ACCOUNTS = [account("acc:cash", "Cash"), account("acc:momo", "MoMo")];

const CATEGORIES: Category[] = [
  { id: "cat:food", userId: USER, name: "Food", kind: "expense", isDefault: true, createdAt: "x" },
  {
    id: "cat:transfers",
    userId: USER,
    name: "Transfers",
    kind: "transfer",
    isDefault: true,
    createdAt: "x",
  },
  {
    id: feesCategoryId(USER),
    userId: USER,
    name: "Fees & charges",
    kind: "expense",
    isDefault: true,
    createdAt: "x",
  },
];

function buildInput(overrides: Partial<TransactionBuildInput> = {}): TransactionBuildInput {
  return {
    form: {
      ...createDefaultTransactionForm(),
      type: "expense",
      accountId: "acc:cash",
      destinationAccountId: "acc:momo",
      categoryId: "cat:food",
      amount: "10000",
      occurredOn: "2026-08-17",
    },
    userId: USER,
    timestamp: "2026-08-17T12:00:00.000Z",
    editingTransactionId: null,
    existingTransactions: [],
    ...overrides,
  };
}

const plan = (build: TransactionBuildInput) =>
  planTransactionWrite({
    build,
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    rules: [],
    counterparty: null,
  });

describe("planTransactionWrite", () => {
  it("writes one row for an expense and removes nothing", () => {
    const result = plan(buildInput());
    expect(result.rows).toHaveLength(1);
    expect(result.fee).toBeNull();
    expect(result.staleIds).toEqual([]);
  });

  it("writes a balanced pair for a transfer", () => {
    const result = plan(
      buildInput({ form: { ...buildInput().form, type: "transfer", categoryId: "cat:transfers" } }),
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].amount + result.rows[1].amount).toBe(0);
  });

  it("adds a fee against the first row", () => {
    const result = plan(buildInput({ form: { ...buildInput().form, feeAmount: "500" } }));
    expect(result.fee?.amount).toBe(500);
    expect(result.fee?.feeParentId).toBe(result.rows[0].id);
  });

  it("removes the original row when a type change replaces it", () => {
    const original = plan(buildInput()).rows[0];

    const result = plan(
      buildInput({
        form: { ...buildInput().form, type: "transfer", categoryId: "cat:transfers" },
        editingTransactionId: original.id,
        existingTransactions: [original],
      }),
    );

    expect(result.rows).toHaveLength(2);
    expect(result.staleIds).toEqual([original.id]);
  });

  it("removes the orphaned leg when a transfer becomes an expense", () => {
    const pair = plan(
      buildInput({ form: { ...buildInput().form, type: "transfer", categoryId: "cat:transfers" } }),
    ).rows;

    const result = plan(
      buildInput({
        editingTransactionId: pair[0].id,
        existingTransactions: pair,
      }),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe(pair[0].id);
    expect(result.staleIds).toEqual([pair[1].id]);
  });

  it("reuses the existing fee rather than writing a second one", () => {
    const first = plan(buildInput({ form: { ...buildInput().form, feeAmount: "500" } }));
    const stored = [first.rows[0], first.fee!];

    const result = plan(
      buildInput({
        form: { ...buildInput().form, feeAmount: "900" },
        editingTransactionId: first.rows[0].id,
        existingTransactions: stored,
      }),
    );

    expect(result.fee?.id).toBe(first.fee!.id);
    expect(result.fee?.amount).toBe(900);
    expect(result.staleIds).toEqual([]);
  });

  it("removes the fee when the amount is cleared", () => {
    const first = plan(buildInput({ form: { ...buildInput().form, feeAmount: "500" } }));
    const stored = [first.rows[0], first.fee!];

    const result = plan(
      buildInput({
        form: { ...buildInput().form, feeAmount: "" },
        editingTransactionId: first.rows[0].id,
        existingTransactions: stored,
      }),
    );

    expect(result.fee).toBeNull();
    expect(result.staleIds).toEqual([first.fee!.id]);
  });

  it("stamps a named counterparty onto both transfer legs", () => {
    const result = planTransactionWrite({
      build: buildInput({
        form: { ...buildInput().form, type: "transfer", categoryId: "cat:transfers" },
      }),
      accounts: ACCOUNTS,
      categories: CATEGORIES,
      rules: [],
      counterparty: {
        id: "cp:1",
        userId: USER,
        name: "Kirkman",
        kind: "borrower",
        isArchived: false,
        createdAt: "x",
        updatedAt: "x",
      },
    });

    expect(result.rows.map((row) => row.counterpartyId)).toEqual(["cp:1", "cp:1"]);
    expect(result.rows.map((row) => row.payee)).toEqual(["Kirkman", "Kirkman"]);
  });

  it("refuses a debt payment with no loan chosen", () => {
    expect(() =>
      plan(
        buildInput({
          form: { ...buildInput().form, type: "debt_payment", destinationAccountId: "acc:missing" },
        }),
      ),
    ).toThrow("Choose which loan you are paying.");
  });
});
