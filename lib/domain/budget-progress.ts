// Meter maths for budget envelopes.
//
// A budget is a container that empties, so the list needs a fill to read at a
// glance — the old rows carried only "Allocated X · Spent Y" in muted text,
// which made you do the subtraction yourself on every line.

import type { BudgetEnvelope } from "@/lib/domain/budgets";

/**
 * Reserved status states, in the app's good / warning / critical order. Text
 * always states which one applies: the amber and red steps sit close enough
 * together that colour alone would not distinguish them.
 */
export type EnvelopeStatus = "on_track" | "near_limit" | "overspent";

/** Spending at or past this share of an envelope is worth flagging early. */
const NEAR_LIMIT_FRACTION = 0.85;

export type EnvelopeProgress = {
  /** 0–1, clamped, so an overspent meter fills its track rather than overflowing. */
  fraction: number;
  status: EnvelopeStatus;
  /** 0 unless overspent. */
  overspentBy: number;
};

export function getEnvelopeProgress(envelope: BudgetEnvelope): EnvelopeProgress {
  const { allocated, spent } = envelope;
  const overspentBy = Math.max(0, spent - allocated);

  // A zero allocation has no meaningful ratio: any spending against it is
  // already over, and no spending is simply empty.
  if (allocated <= 0) {
    return {
      fraction: spent > 0 ? 1 : 0,
      status: spent > 0 ? "overspent" : "on_track",
      overspentBy,
    };
  }

  const ratio = spent / allocated;

  return {
    fraction: Math.min(1, Math.max(0, ratio)),
    status: overspentBy > 0 ? "overspent" : ratio >= NEAR_LIMIT_FRACTION ? "near_limit" : "on_track",
    overspentBy,
  };
}

export type BudgetMonthPosition = {
  allocated: number;
  spent: number;
  remaining: number;
  overspentCount: number;
  unallocatedIncome: number;
};

export function getBudgetMonthPosition(
  envelopes: BudgetEnvelope[],
  capacity: { inflow: number; allocated: number; unallocatedIncome: number },
): BudgetMonthPosition {
  const allocated = envelopes.reduce((sum, envelope) => sum + envelope.allocated, 0);
  const spent = envelopes.reduce((sum, envelope) => sum + envelope.spent, 0);

  return {
    allocated,
    spent,
    remaining: allocated - spent,
    overspentCount: envelopes.filter((envelope) => envelope.isOverspent).length,
    unallocatedIncome: capacity.unallocatedIncome,
  };
}
