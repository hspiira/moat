"use client";

// Rules and recurring-obligation slice of the transactions workspace.
// Composed inside useTransactionsWorkspace.

import { useCallback, useState } from "react";

import { repositories } from "@/lib/repositories/instance";
import type { RecurringObligation, TransactionRule, UserProfile } from "@/lib/types";

export function useRulesAndObligations(params: {
  profile: UserProfile | null;
  onMutated: () => Promise<void>;
  onObligationsChanged: (userId: string) => Promise<void>;
  setIsSubmitting: (value: boolean) => void;
}) {
  const { profile, onMutated, onObligationsChanged, setIsSubmitting } = params;
  const [transactionRules, setTransactionRules] = useState<TransactionRule[]>([]);
  const [recurringObligations, setRecurringObligations] = useState<RecurringObligation[]>([]);

  const saveRule = useCallback(
    async (rule: Omit<TransactionRule, "id" | "userId" | "createdAt" | "updatedAt">) => {
      if (!profile) return;
      setIsSubmitting(true);
      try {
        const timestamp = new Date().toISOString();
        await repositories.transactionRules.upsert({
          id: `rule:${crypto.randomUUID()}`,
          userId: profile.id,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...rule,
        });
        await onMutated();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onMutated, profile, setIsSubmitting],
  );

  const toggleRule = useCallback(
    async (rule: TransactionRule) => {
      setIsSubmitting(true);
      try {
        await repositories.transactionRules.upsert({
          ...rule,
          enabled: !rule.enabled,
          updatedAt: new Date().toISOString(),
        });
        await onMutated();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onMutated, setIsSubmitting],
  );

  const saveObligation = useCallback(
    async (obligation: Omit<RecurringObligation, "id" | "userId" | "createdAt" | "updatedAt">) => {
      if (!profile) return;
      setIsSubmitting(true);
      try {
        const timestamp = new Date().toISOString();
        await repositories.recurringObligations.upsert({
          id: `obligation:${crypto.randomUUID()}`,
          userId: profile.id,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...obligation,
        });
        await onObligationsChanged(profile.id);
        await onMutated();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onMutated, onObligationsChanged, profile, setIsSubmitting],
  );

  const toggleObligation = useCallback(
    async (obligation: RecurringObligation) => {
      setIsSubmitting(true);
      try {
        await repositories.recurringObligations.upsert({
          ...obligation,
          status: obligation.status === "active" ? "paused" : "active",
          updatedAt: new Date().toISOString(),
        });
        if (profile) {
          await onObligationsChanged(profile.id);
        }
        await onMutated();
      } finally {
        setIsSubmitting(false);
      }
    },
    [onMutated, onObligationsChanged, profile, setIsSubmitting],
  );

  return {
    transactionRules,
    setTransactionRules,
    recurringObligations,
    setRecurringObligations,
    saveRule,
    toggleRule,
    saveObligation,
    toggleObligation,
  };
}
