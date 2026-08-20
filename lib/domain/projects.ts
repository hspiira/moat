import { isSpendingTransaction, isTransferTransaction } from "@/lib/domain/transfers";
import type { Category, Project, Transaction } from "@/lib/types";

export type ProjectCategorySpend = {
  categoryId: string;
  categoryName: string;
  amount: number;
};

export type ProjectSummary = {
  project: Project;
  spent: number;
  count: number;
  byCategory: ProjectCategorySpend[];
  firstOn: string | null;
  lastOn: string | null;
  monthsSpanned: number;
  budgetRemaining: number | null;
  isOverBudget: boolean;
};

export function isProjectSpend(transaction: Transaction, projectId: string): boolean {
  return (
    transaction.projectId === projectId &&
    !isTransferTransaction(transaction) &&
    isSpendingTransaction(transaction)
  );
}

function monthsBetween(first: string, last: string): number {
  const [firstYear, firstMonth] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  return (lastYear - firstYear) * 12 + (lastMonth - firstMonth) + 1;
}

export function getProjectSummary(
  project: Project,
  transactions: Transaction[],
  categories: Category[],
): ProjectSummary {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const totals = new Map<string, ProjectCategorySpend>();

  let spent = 0;
  let count = 0;
  let firstOn: string | null = null;
  let lastOn: string | null = null;

  for (const transaction of transactions) {
    if (!isProjectSpend(transaction, project.id)) continue;

    const amount = Math.abs(transaction.amount);
    spent += amount;
    count += 1;

    if (firstOn === null || transaction.occurredOn < firstOn) firstOn = transaction.occurredOn;
    if (lastOn === null || transaction.occurredOn > lastOn) lastOn = transaction.occurredOn;

    const held = totals.get(transaction.categoryId);
    totals.set(transaction.categoryId, {
      categoryId: transaction.categoryId,
      categoryName:
        held?.categoryName ?? names.get(transaction.categoryId) ?? "Uncategorized",
      amount: (held?.amount ?? 0) + amount,
    });
  }

  const budgetRemaining =
    typeof project.budgetAmount === "number" ? project.budgetAmount - spent : null;

  return {
    project,
    spent,
    count,
    byCategory: [...totals.values()].sort((left, right) => right.amount - left.amount),
    firstOn,
    lastOn,
    monthsSpanned:
      firstOn && lastOn ? monthsBetween(firstOn.slice(0, 7), lastOn.slice(0, 7)) : 0,
    budgetRemaining,
    isOverBudget: budgetRemaining !== null && budgetRemaining < 0,
  };
}

// How much of a category's spending in this set belongs to a project. This is
// what lets a spike be explained rather than merely flagged.
export function projectSpendForCategory(
  transactions: Transaction[],
  categoryId: string,
  projects: Project[],
): { project: Project; amount: number } | null {
  const byProject = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.categoryId !== categoryId || !transaction.projectId) continue;
    if (isTransferTransaction(transaction) || !isSpendingTransaction(transaction)) continue;
    byProject.set(
      transaction.projectId,
      (byProject.get(transaction.projectId) ?? 0) + Math.abs(transaction.amount),
    );
  }

  const largest = [...byProject.entries()].sort(([, left], [, right]) => right - left)[0];
  if (!largest) return null;

  const project = projects.find((entry) => entry.id === largest[0]);
  return project ? { project, amount: largest[1] } : null;
}

export function activeProjects(projects: Project[]): Project[] {
  return projects.filter((project) => !project.isArchived && !project.endedOn);
}
