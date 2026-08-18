import type { BudgetEnvelope } from "@/lib/domain/budgets";
import type { RecurringEvaluation } from "@/lib/domain/recurring";
import { formatMoney } from "@/lib/currency";

const DUE_SOON_WINDOW_DAYS = 5;

export function getBillsDueSoon(
  evaluations: RecurringEvaluation[],
  today: Date,
): AttentionItem[] {
  const dayOfMonth = today.getDate();

  return evaluations
    .filter((evaluation) => evaluation.state !== "paid")
    .filter((evaluation) => {
      const dueDay = evaluation.obligation.dueDay;
      if (!dueDay) return false;
      return dueDay <= dayOfMonth + DUE_SOON_WINDOW_DAYS;
    })
    .map((evaluation) => {
      const dueDay = evaluation.obligation.dueDay ?? 0;
      const daysLeft = dueDay - dayOfMonth;
      const outstanding = Math.max(
        0,
        evaluation.expectedAmount - evaluation.matchedAmount,
      );
      const when =
        daysLeft < 0
          ? `was due on the ${ordinal(dueDay)}`
          : daysLeft === 0
            ? "is due today"
            : daysLeft === 1
              ? "is due tomorrow"
              : `is due in ${daysLeft} days`;

      return {
        id: `bill-due:${evaluation.obligation.id}`,
        title: `${evaluation.obligation.name} ${when}`,
        body:
          outstanding > 0
            ? `${formatMoney(outstanding)} still to pay this month.`
            : "Not yet marked as paid this month.",
        href: "/recurring",
      };
    });
}

function ordinal(day: number): string {
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  return `${day}${suffix}`;
}

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

export function getAttentionItems({
  envelopes,
  billsDueSoon = [],
  reviewCount,
  insights,
  habits = [],
}: {
  envelopes: BudgetEnvelope[];
  billsDueSoon?: AttentionItem[];
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
            href: "/inbox",
          },
        ]
      : [];

  return [
    ...overspent,
    ...billsDueSoon,
    ...review,
    ...insights.map((insight) => ({ ...insight })),
    ...habits,
  ];
}
