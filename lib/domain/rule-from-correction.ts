import type { CorrectionLog, TransactionRule } from "@/lib/types";

export type RuleDraft = Omit<TransactionRule, "id" | "userId" | "createdAt" | "updatedAt">;

// A correction says the parser read something wrongly and you fixed it by hand.
// The same fix as a rule is the parser getting it right next time.
export function buildRuleFromCorrection(log: CorrectionLog): RuleDraft | null {
  const readPayee = log.originalSnapshot.payee.trim();
  if (!readPayee) return null;

  const fixedPayee = log.approvedSnapshot.payee.trim();
  const payeeChanged = fixedPayee !== "" && fixedPayee !== readPayee;
  const categoryChanged =
    log.approvedSnapshot.categoryId !== "" &&
    log.approvedSnapshot.categoryId !== log.originalSnapshot.categoryId;

  if (!payeeChanged && !categoryChanged) return null;

  return {
    name: `Fix ${readPayee}`,
    enabled: true,
    priority: 100,
    source: log.source,
    payeePattern: readPayee,
    effectPayee: payeeChanged ? fixedPayee : undefined,
    effectCategoryId: categoryChanged ? log.approvedSnapshot.categoryId : undefined,
    // Left off on purpose: a rule built from one correction has not earned the
    // right to approve later captures without you looking at them.
    autoMarkReviewed: false,
  };
}
