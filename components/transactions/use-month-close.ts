"use client";

import { useCallback, useState } from "react";

import { readDebtPlannerSettings } from "@/lib/preferences/debt-planner";
import { evaluateMonth } from "@/lib/domain/month-evaluation";
import {
  buildMonthCloseRecord,
  type MonthCloseEvaluation,
} from "@/lib/domain/reconciliation";
import { errorMessage } from "@/lib/errors";
import { repositories } from "@/lib/repositories/instance";
import type { Category, MonthClose, Transaction, UserProfile } from "@/lib/types";

import { buildMonthCloseCsv } from "./month-close-export";

const emptyEvaluation: MonthCloseEvaluation = {
  unresolvedTransactions: [],
  duplicateGroups: [],
  missingCategoryTransactions: [],
  recurringDueCount: 0,
  recurringMissingCount: 0,
  isReadyToClose: false,
};

/**
 * Closing a month.
 *
 * `refresh` reads straight from storage rather than from the workspace's state,
 * because it also runs after an obligation changes, before that state has been
 * reloaded.
 */
export function useMonthClose({
  profile,
  closePeriod,
  transactions,
  categories,
  debtPlannerSettings,
  onMutated,
  setIsSubmitting,
  show,
}: {
  profile: UserProfile | null;
  closePeriod: string;
  transactions: Transaction[];
  categories: Category[];
  debtPlannerSettings: ReturnType<typeof readDebtPlannerSettings>;
  onMutated: () => Promise<void>;
  setIsSubmitting: (value: boolean) => void;
  show: (message: string, tone: "error" | "success") => void;
}) {
  const [monthClose, setMonthClose] = useState<MonthClose | null>(null);
  const [monthCloseEvaluation, setMonthCloseEvaluation] =
    useState<MonthCloseEvaluation>(emptyEvaluation);

  const refreshMonthCloseState = useCallback(
    async (userId: string) => {
      const [
        storedAccounts,
        storedTransactions,
        storedCategories,
        storedObligations,
        existingMonthClose,
      ] = await Promise.all([
        repositories.accounts.listByUser(userId),
        repositories.transactions.listByUser(userId),
        repositories.categories.listByUser(userId),
        repositories.recurringObligations.listByUser(userId),
        repositories.monthCloses.getByPeriod(userId, closePeriod),
      ]);
      const evaluation = evaluateMonth({
        accounts: storedAccounts,
        transactions: storedTransactions,
        categories: storedCategories,
        obligations: storedObligations,
        closePeriod,
        debtPlannerSettings,
      });
      const nextRecord = buildMonthCloseRecord(
        existingMonthClose,
        userId,
        closePeriod,
        evaluation,
      );
      await repositories.monthCloses.upsert(nextRecord);
      setMonthClose(nextRecord);
      setMonthCloseEvaluation(evaluation);
    },
    [closePeriod, debtPlannerSettings],
  );

  const closeMonth = useCallback(async () => {
    if (!profile || !monthCloseEvaluation.isReadyToClose) return;
    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      await repositories.monthCloses.upsert({
        ...(monthClose ??
          buildMonthCloseRecord(null, profile.id, closePeriod, monthCloseEvaluation)),
        state: "closed",
        closedAt: timestamp,
        updatedAt: timestamp,
      });
      await onMutated();
      show(`${closePeriod} closed.`, "success");
    } catch (closeError) {
      show(errorMessage(closeError, "Couldn't close the month."), "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    closePeriod,
    monthClose,
    monthCloseEvaluation,
    onMutated,
    profile,
    setIsSubmitting,
    show,
  ]);

  const exportMonthClose = useCallback(() => {
    const csv = buildMonthCloseCsv(transactions, categories, closePeriod);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `month-close-${closePeriod}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [categories, closePeriod, transactions]);

  return {
    monthClose,
    setMonthClose,
    monthCloseEvaluation,
    setMonthCloseEvaluation,
    refreshMonthCloseState,
    closeMonth,
    exportMonthClose,
  };
}
