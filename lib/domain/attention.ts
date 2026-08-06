import type { BudgetEnvelope } from "@/lib/domain/budgets";
import { formatMoney } from "@/lib/currency";

export type AttentionItem = {
  id: string;
  title: string;
  body: string;
  href?: string;
};

export type HabitInput = {
  savingsRate: number;
  hasIncome: boolean;
  coverMonths: number;
  targetCoverMonths: number;
};

/**
 * Plain observations about how the period went, stated as facts.
 *
 * Deliberately not a persona or a score. Apps that award you a title are
 * selling the next product; a spending tracker's job is to say what happened
 * and let the reader draw the conclusion.
 */
export function getHabitItems(input: HabitInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.hasIncome && input.savingsRate > 0) {
    items.push({
      id: "habit:saving",
      title: `You kept ${Math.round(input.savingsRate * 100)}% of what came in`,
      body: "That share is what builds the moat.",
    });
  }

  if (input.hasIncome && input.savingsRate < 0) {
    items.push({
      id: "habit:deficit",
      title: "You spent more than you earned this period",
      body: "The difference came out of your existing balance.",
    });
  }

  if (input.coverMonths > 0 && input.coverMonths < input.targetCoverMonths) {
    const remaining = input.targetCoverMonths - input.coverMonths;
    items.push({
      id: "habit:cover",
      title: `${input.coverMonths.toFixed(1)} months of cover`,
      body: `${remaining.toFixed(1)} more months of typical spending reaches your ${input.targetCoverMonths}-month target.`,
      href: "/goals",
    });
  }

  return items;
}

/**
 * Everything asking for a decision, in one list. Ordered by how much it costs to
 * ignore: money already overspent, then a queue that grows while untouched, then
 * observations that are only ever advisory.
 */
export function getAttentionItems({
  envelopes,
  reviewCount,
  insights,
  habits = [],
}: {
  envelopes: BudgetEnvelope[];
  reviewCount: number;
  insights: { id: string; title: string; body: string }[];
  habits?: AttentionItem[];
}): AttentionItem[] {
  const overspent: AttentionItem[] = envelopes
    .filter((envelope) => envelope.isOverspent)
    .map((envelope) => ({
      id: `overspent:${envelope.budgetId}`,
      title: envelope.categoryName,
      body: `Over budget by ${formatMoney(Math.abs(envelope.remaining))}.`,
      href: "/budgets",
    }));

  const review: AttentionItem[] =
    reviewCount > 0
      ? [
          {
            id: "capture-review",
            title: reviewCount === 1 ? "1 capture to review" : `${reviewCount} captures to review`,
            body: "Read from your messages and waiting for you to confirm.",
            href: "/transactions/review",
          },
        ]
      : [];

  return [
    ...overspent,
    ...review,
    ...insights.map((insight) => ({ ...insight })),
    // Habits go last: they are observations, not decisions waiting on you.
    ...habits,
  ];
}
