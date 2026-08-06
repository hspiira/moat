import type { BudgetEnvelope } from "@/lib/domain/budgets";
import { formatMoney } from "@/lib/currency";

export type AttentionItem = {
  id: string;
  title: string;
  body: string;
  href?: string;
};

/**
 * Everything asking for a decision, in one list. Ordered by how much it costs to
 * ignore: money already overspent, then a queue that grows while untouched, then
 * observations that are only ever advisory.
 */
export function getAttentionItems({
  envelopes,
  reviewCount,
  insights,
}: {
  envelopes: BudgetEnvelope[];
  reviewCount: number;
  insights: { id: string; title: string; body: string }[];
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

  return [...overspent, ...review, ...insights.map((insight) => ({ ...insight }))];
}
