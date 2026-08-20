import { describe, expect, it } from "vitest";

import {
  activeProjects,
  getProjectSummary,
  projectSpendForCategory,
} from "@/lib/domain/projects";
import type { Category, Project, Transaction } from "@/lib/types";

const USER = "user:ada";
const STAMP = "2026-06-01T00:00:00.000Z";

const relocation: Project = {
  id: "project:relocation",
  userId: USER,
  name: "Relocation",
  startedOn: "2026-06-01",
  budgetAmount: 4_000_000,
  isArchived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const categories: Category[] = [
  { id: "cat:rent", userId: USER, name: "Rent", kind: "expense", isDefault: true, createdAt: STAMP },
  { id: "cat:boda", userId: USER, name: "Transport / boda", kind: "expense", isDefault: true, createdAt: STAMP },
  { id: "cat:home", userId: USER, name: "Household", kind: "expense", isDefault: true, createdAt: STAMP },
];

function transaction(values: Partial<Transaction> & { id: string }): Transaction {
  return {
    userId: USER,
    accountId: "acc:momo",
    type: "expense",
    amount: 100_000,
    currency: "UGX",
    originalAmount: 100_000,
    occurredOn: "2026-06-10",
    categoryId: "cat:rent",
    reconciliationState: "posted",
    source: "manual",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...values,
  };
}

const tagged = [
  transaction({ id: "t1", amount: 2_000_000, projectId: relocation.id, occurredOn: "2026-06-10" }),
  transaction({ id: "t2", amount: 300_000, categoryId: "cat:home", projectId: relocation.id, occurredOn: "2026-07-02" }),
  transaction({ id: "t3", amount: 120_000, categoryId: "cat:boda", projectId: relocation.id, occurredOn: "2026-08-05" }),
  transaction({ id: "u1", amount: 50_000, categoryId: "cat:boda", occurredOn: "2026-08-06" }),
];

describe("getProjectSummary", () => {
  it("totals what a project has cost across categories and months", () => {
    const summary = getProjectSummary(relocation, tagged, categories);

    expect(summary.spent).toBe(2_420_000);
    expect(summary.count).toBe(3);
    expect(summary.byCategory).toHaveLength(3);
    expect(summary.byCategory[0]).toMatchObject({ categoryName: "Rent", amount: 2_000_000 });
    expect(summary.monthsSpanned).toBe(3);
    expect(summary.firstOn).toBe("2026-06-10");
    expect(summary.lastOn).toBe("2026-08-05");
  });

  it("leaves untagged spending out, even in the same category", () => {
    const summary = getProjectSummary(relocation, tagged, categories);
    const boda = summary.byCategory.find((entry) => entry.categoryName.includes("boda"));

    expect(boda?.amount).toBe(120_000);
  });

  it("reports what is left of a budget", () => {
    const summary = getProjectSummary(relocation, tagged, categories);

    expect(summary.budgetRemaining).toBe(1_580_000);
    expect(summary.isOverBudget).toBe(false);
  });

  it("says when a project has gone past its budget", () => {
    const summary = getProjectSummary(
      { ...relocation, budgetAmount: 2_000_000 },
      tagged,
      categories,
    );

    expect(summary.budgetRemaining).toBe(-420_000);
    expect(summary.isOverBudget).toBe(true);
  });

  it("has no budget opinion when none was set", () => {
    const summary = getProjectSummary(
      { ...relocation, budgetAmount: undefined },
      tagged,
      categories,
    );

    expect(summary.budgetRemaining).toBeNull();
    expect(summary.isOverBudget).toBe(false);
  });

  it("counts a project with nothing tagged as costing nothing", () => {
    const summary = getProjectSummary(relocation, [transaction({ id: "x" })], categories);

    expect(summary.spent).toBe(0);
    expect(summary.monthsSpanned).toBe(0);
  });

  it("ignores a transfer, which moves money rather than spending it", () => {
    const summary = getProjectSummary(
      relocation,
      [
        transaction({
          id: "move",
          type: "transfer",
          amount: -500_000,
          projectId: relocation.id,
          transferGroupId: "g",
        }),
      ],
      categories,
    );

    expect(summary.spent).toBe(0);
  });
});

describe("projectSpendForCategory", () => {
  it("names how much of a category belongs to a project", () => {
    const found = projectSpendForCategory(tagged, "cat:rent", [relocation]);

    expect(found?.project.name).toBe("Relocation");
    expect(found?.amount).toBe(2_000_000);
  });

  it("finds nothing when the category carries no project", () => {
    expect(projectSpendForCategory(tagged, "cat:food", [relocation])).toBeNull();
  });

  it("finds nothing when the project is unknown", () => {
    expect(projectSpendForCategory(tagged, "cat:rent", [])).toBeNull();
  });
});

describe("activeProjects", () => {
  it("keeps what is still running", () => {
    expect(activeProjects([relocation])).toHaveLength(1);
  });

  it("drops what has ended or been archived", () => {
    expect(
      activeProjects([
        { ...relocation, id: "p:done", endedOn: "2026-08-31" },
        { ...relocation, id: "p:gone", isArchived: true },
      ]),
    ).toEqual([]);
  });
});
