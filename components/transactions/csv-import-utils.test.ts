import { describe, expect, it } from "vitest";

import { buildImportPreviewRows, defaultCsvMappings } from "@/components/transactions/csv-import-utils";
import type { Account, Category, Transaction } from "@/lib/types";

const account: Account = {
  id: "account:bank",
  userId: "user:default",
  name: "Bank",
  type: "bank",
  openingBalance: 0,
  balance: 0,
  isArchived: false,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

const category: Category = {
  id: "category:salary",
  userId: "user:default",
  name: "Salary",
  kind: "income",
  isDefault: false,
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("csv import preview", () => {
  it("retains source currency and FX while normalizing to UGX", () => {
    const preview = buildImportPreviewRows({
      rows: [["2026-04-01", "100", "USD", "3700", "Employer Ltd", "Income payment", "income", "Salary", "Bank"]],
      csvHeaders: ["date", "amount", "currency", "fx", "payee", "note", "type", "category", "account"],
      csvMappings: {
        ...defaultCsvMappings,
        date: "date",
        amount: "amount",
        currency: "currency",
        fxRate: "fx",
        payee: "payee",
        note: "note",
        type: "type",
        category: "category",
        account: "account",
      },
      accounts: [account],
      categories: [category],
      transactions: [] as Transaction[],
      defaultImportType: "income",
      defaultImportAccountId: account.id,
      defaultImportCategoryId: category.id,
      defaultImportCurrency: "UGX",
      defaultImportFxRate: "",
    });

    expect(preview[0].currency).toBe("USD");
    expect(preview[0].originalAmount).toBe(100);
    expect(preview[0].fxRateToUgx).toBe(3700);
    expect(preview[0].normalizedAmount).toBe(370000);
    expect(preview[0].issues).toHaveLength(0);
  });
});
