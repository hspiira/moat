import { describe, expect, it } from "vitest";

import {
  allowedCategoryKinds,
  assertCategoryMatchesType,
  categoryMatchesType,
  coerceCategoryForType,
  defaultCategoryForType,
  transactionTypeForCategory,
} from "@/lib/domain/transaction-classification";
import type { Category, CategoryKind, TransactionType } from "@/lib/types";

function category(id: string, kind: CategoryKind): Category {
  return {
    id,
    userId: "user:default",
    name: id.replace("category:", ""),
    kind,
    isDefault: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const catalogue: Category[] = [
  category("category:salary", "income"),
  category("category:food", "expense"),
  category("category:airtime-data", "expense"),
  category("category:savings", "savings"),
  category("category:transfers", "transfer"),
  category("category:debt-repayment", "debt_repayment"),
  category("category:money-lent-out", "lending"),
];

describe("allowedCategoryKinds", () => {
  it("gives every transaction type at least one kind", () => {
    for (const [type, kinds] of Object.entries(allowedCategoryKinds)) {
      expect(kinds.length, `${type} has no allowed category kind`).toBeGreaterThan(0);
    }
  });

  it("never lets a purpose kind be reachable from more than one type", () => {
    // The bug this whole module exists to prevent: two types sharing a kind is
    // what let "Debt payment" be paired with "Food".
    const seen = new Map<string, string>();

    for (const [type, kinds] of Object.entries(allowedCategoryKinds)) {
      for (const kind of kinds) {
        const owner = seen.get(kind);
        expect(owner, `${kind} is reachable from both ${owner} and ${type}`).toBeUndefined();
        seen.set(kind, type);
      }
    }
  });
});

describe("transactionTypeForCategory", () => {
  it("derives the type from the category, so the user never picks both", () => {
    const cases: [string, CategoryKind, TransactionType][] = [
      ["salary", "income", "income"],
      ["food", "expense", "expense"],
      ["savings", "savings", "savings_contribution"],
      ["transfers", "transfer", "transfer"],
      ["debt-repayment", "debt_repayment", "debt_payment"],
      // Lending is a transfer into a receivable, not a category of spending.
      ["lending", "lending", "transfer"],
    ];

    for (const [id, kind, expected] of cases) {
      expect(transactionTypeForCategory(category(`category:${id}`, kind))).toBe(expected);
    }
  });

  it("derives a type for every kind that exists", () => {
    const kinds: CategoryKind[] = [
      "income",
      "expense",
      "savings",
      "transfer",
      "debt_repayment",
      "lending",
    ];

    for (const kind of kinds) {
      expect(transactionTypeForCategory(category("category:x", kind))).toBeDefined();
    }
  });

  it("always derives a type the category is actually valid for", () => {
    // The round trip that makes the picker safe: choosing any category and
    // deriving its type can never produce the mismatch this module prevents.
    for (const entry of catalogue) {
      const derived = transactionTypeForCategory(entry);
      expect(categoryMatchesType(entry, derived), `${entry.id} -> ${derived}`).toBe(true);
    }
  });
});

describe("categoryMatchesType", () => {
  it("keeps debt repayment out of the ordinary expense list", () => {
    expect(categoryMatchesType(category("category:food", "expense"), "debt_payment")).toBe(false);
    expect(
      categoryMatchesType(category("category:airtime-data", "expense"), "debt_payment"),
    ).toBe(false);
  });

  it("keeps ordinary expenses out of the debt repayment list", () => {
    expect(
      categoryMatchesType(category("category:debt-repayment", "debt_repayment"), "expense"),
    ).toBe(false);
  });

  it("matches each type to its own kind", () => {
    const cases: [TransactionType, string][] = [
      ["income", "category:salary"],
      ["expense", "category:food"],
      ["savings_contribution", "category:savings"],
      ["transfer", "category:transfers"],
      ["debt_payment", "category:debt-repayment"],
    ];

    for (const [type, categoryId] of cases) {
      const match = catalogue.find((entry) => entry.id === categoryId);
      expect(categoryMatchesType(match!, type), `${categoryId} should match ${type}`).toBe(true);
    }
  });

  it("treats money lent out as a transfer, so lending is never spending", () => {
    expect(categoryMatchesType(category("category:money-lent-out", "lending"), "transfer")).toBe(
      true,
    );
    expect(categoryMatchesType(category("category:money-lent-out", "lending"), "expense")).toBe(
      false,
    );
  });
});

describe("defaultCategoryForType", () => {
  it("picks a category that matches the type", () => {
    expect(defaultCategoryForType(catalogue, "debt_payment")?.id).toBe("category:debt-repayment");
    expect(defaultCategoryForType(catalogue, "income")?.id).toBe("category:salary");
  });

  it("returns undefined when the catalogue has nothing for the type", () => {
    expect(defaultCategoryForType([category("category:food", "expense")], "income")).toBeUndefined();
  });
});

describe("assertCategoryMatchesType", () => {
  it("accepts a coherent pair", () => {
    expect(() =>
      assertCategoryMatchesType(catalogue, "debt_payment", "category:debt-repayment"),
    ).not.toThrow();
  });

  it("rejects the pair the user complained about, by name", () => {
    expect(() => assertCategoryMatchesType(catalogue, "debt_payment", "category:food")).toThrow(
      /food.*debt payment/i,
    );
  });

  it("rejects a category that does not exist", () => {
    expect(() => assertCategoryMatchesType(catalogue, "expense", "category:nope")).toThrow(
      /not a category/i,
    );
  });
});

describe("coerceCategoryForType", () => {
  // Imported and parsed rows have no user present to fix a mismatch, so they
  // are snapped to something coherent rather than thrown away.
  it("leaves a coherent pair alone", () => {
    expect(coerceCategoryForType(catalogue, "expense", "category:food")).toBe("category:food");
  });

  it("snaps an incoherent pair to a category the type allows", () => {
    expect(coerceCategoryForType(catalogue, "debt_payment", "category:food")).toBe(
      "category:debt-repayment",
    );
  });

  it("snaps an unknown category to one the type allows", () => {
    expect(coerceCategoryForType(catalogue, "income", "category:does-not-exist")).toBe(
      "category:salary",
    );
  });

  it("returns the original when the catalogue offers no valid alternative", () => {
    expect(coerceCategoryForType([category("category:food", "expense")], "income", "category:food")).toBe(
      "category:food",
    );
  });
});
