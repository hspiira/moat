"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import { announceLocalSave } from "@/lib/local-save";
import { repositories } from "@/lib/repositories/instance";
import { buildFeeTransaction } from "@/components/transactions/transaction-builder";
import { feesCategoryId, ensureFeesCategory } from "@/lib/app-state/defaults";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { applyTransactionRules } from "@/lib/domain/rules";
import { getSummaryForTransactions } from "@/lib/domain/summaries";
import { canApproveCaptureItem, isCaptureItemEditable } from "@/lib/domain/capture-review";
import { detectCaptureDuplicate } from "@/lib/capture/deduplication";
import {
  buildTransactionFromCaptureReviewItem,
  createCorrectionLog,
  getOpenCaptureReviewItems,
  validateCaptureReviewItem,
} from "@/lib/capture/review-queue";
import type {
  Account,
  CaptureReviewItem,
  Category,
  Transaction,
  TransactionRule,
  UserProfile,
} from "@/lib/types";
import { currentMonthIso } from "@/lib/today";

function sortByUpdatedAt(items: CaptureReviewItem[]) {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const MANUAL_DUPLICATE_ISSUE = "Marked as duplicate";

function resolveOpenStatus(item: CaptureReviewItem, issues: string[]): CaptureReviewItem["status"] {
  if (item.status === "approved" || item.status === "rejected") return item.status;
  if (item.duplicateTransactionId || item.duplicateCaptureReviewItemId) return "duplicate";
  if (issues.includes(MANUAL_DUPLICATE_ISSUE)) return "duplicate";
  return issues.length > 0 ? "needs_review" : "new";
}

export function useCaptureReviewWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionRules, setTransactionRules] = useState<TransactionRule[]>([]);
  const [captureReviewItems, setCaptureReviewItems] = useState<CaptureReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentPeriod = currentMonthIso();

  const openCaptureReviewItems = useMemo(
    () => getOpenCaptureReviewItems(captureReviewItems),
    [captureReviewItems],
  );

  const periodTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.occurredOn.startsWith(currentPeriod)),
    [currentPeriod, transactions],
  );

  const periodSummary = useMemo(
    () => getSummaryForTransactions(periodTransactions, categories),
    [categories, periodTransactions],
  );

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await repositories.userProfile.get();
      setProfile(nextProfile);

      if (!nextProfile) {
        setAccounts([]);
        setCategories([]);
        setTransactions([]);
        setTransactionRules([]);
        setCaptureReviewItems([]);
        return;
      }

      const [storedAccounts, storedCategories, storedTransactions, storedRules, storedCaptureReviewItems] =
        await Promise.all([
          repositories.accounts.listByUser(nextProfile.id),
          repositories.categories.listByUser(nextProfile.id),
          repositories.transactions.listByUser(nextProfile.id),
          repositories.transactionRules.listByUser(nextProfile.id),
          repositories.captureReviewItems.listByUser(nextProfile.id),
        ]);

      setAccounts(reconcileAccountBalances(storedAccounts, storedTransactions));
      setCategories(storedCategories);
      setTransactions(storedTransactions);
      setTransactionRules(storedRules);
      setCaptureReviewItems(sortByUpdatedAt(storedCaptureReviewItems));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load capture inbox. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, [loadWorkspace]);

  const updateItem = useCallback(async (item: CaptureReviewItem) => {
    if (!isCaptureItemEditable(item)) {
      setError(
        item.status === "approved"
          ? "This item is already in the ledger. Edit the transaction instead."
          : "This item was rejected and can no longer be edited.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const normalizedAmount = item.currency === "UGX" ? item.originalAmount : item.originalAmount * (item.fxRateToUgx ?? 0);
      const issues = validateCaptureReviewItem({
        originalAmount: item.originalAmount,
        currency: item.currency,
        fxRateToUgx: item.fxRateToUgx,
        duplicateTransactionId: item.duplicateTransactionId,
      });
      if (item.issues.includes(MANUAL_DUPLICATE_ISSUE)) {
        issues.push(MANUAL_DUPLICATE_ISSUE);
      }
      await repositories.captureReviewItems.upsert({
        ...item,
        normalizedAmount,
        issues,
        status: resolveOpenStatus(item, issues),
        updatedAt: new Date().toISOString(),
      });
      await loadWorkspace();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update capture item.");
    } finally {
      setIsSubmitting(false);
    }
  }, [loadWorkspace]);

  const approveItem = useCallback(async (item: CaptureReviewItem) => {
    if (!profile) return;

    if (!canApproveCaptureItem(item)) {
      setError(
        item.approvedTransactionId || item.status === "approved"
          ? "This capture is already in the ledger."
          : item.status === "rejected"
            ? "This capture was rejected. Reopen it before approving."
            : "Resolve the remaining capture issues before approving this item.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const issues = validateCaptureReviewItem({
        originalAmount: item.originalAmount,
        currency: item.currency,
        fxRateToUgx: item.fxRateToUgx,
        duplicateTransactionId: item.duplicateTransactionId,
      });
      if (issues.length > 0) {
        throw new Error("Resolve the remaining capture issues before approving this item.");
      }
      const timestamp = new Date().toISOString();
      const baseTransaction = buildTransactionFromCaptureReviewItem({
        item: {
          ...item,
          normalizedAmount:
            item.currency === "UGX" ? item.originalAmount : item.originalAmount * (item.fxRateToUgx ?? 0),
        },
        userId: profile.id,
        createdAt: timestamp,
      });
      const proposed =
        applyTransactionRules(baseTransaction, transactionRules)?.proposedTransaction ?? baseTransaction;
      const approvedSnapshot = {
        accountId: item.accountId,
        occurredOn: item.occurredOn,
        originalAmount: item.originalAmount,
        currency: item.currency,
        fxRateToUgx: item.fxRateToUgx,
        feeAmount: item.feeAmount,
        normalizedAmount:
          item.currency === "UGX" ? item.originalAmount : item.originalAmount * (item.fxRateToUgx ?? 0),
        type: item.type,
        categoryId: item.categoryId,
        payee: item.payee,
        note: item.note,
        parserLabel: item.parserLabel,
        confidenceScore: item.confidenceScore,
        issues,
        fieldWarnings: item.fieldWarnings,
      };

      await repositories.transactions.upsert(proposed);
      if (typeof item.feeAmount === "number" && item.feeAmount > 0) {
        const fee = buildFeeTransaction(proposed, String(item.feeAmount), feesCategoryId(proposed.userId));
        if (fee) {
          const feesCategory = ensureFeesCategory(categories, profile.id);
          if (feesCategory) {
            await repositories.categories.upsert(feesCategory);
          }
          await repositories.transactions.upsert(fee);
        }
      }
      await repositories.correctionLogs.upsert(
        createCorrectionLog({
          userId: profile.id,
          item,
          approvedSnapshot,
          createdAt: timestamp,
        }),
      );
      await repositories.captureReviewItems.upsert({
        ...item,
        approvedTransactionId: proposed.id,
        status: "approved",
        reviewedAt: timestamp,
        resolvedAt: timestamp,
        updatedAt: timestamp,
      });
      announceLocalSave({ entity: "transactions", savedAt: timestamp, message: "Capture approved to ledger locally" });
      await loadWorkspace();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Unable to approve capture item.");
    } finally {
      setIsSubmitting(false);
    }
  }, [categories, loadWorkspace, profile, transactionRules]);

  const rejectItem = useCallback(async (item: CaptureReviewItem) => {
    if (item.status === "approved" || item.approvedTransactionId) {
      setError("This capture is already in the ledger. Delete the transaction to undo it.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const timestamp = new Date().toISOString();
      await repositories.captureReviewItems.upsert({
        ...item,
        status: "rejected",
        reviewedAt: timestamp,
        resolvedAt: timestamp,
        updatedAt: timestamp,
      });
      await loadWorkspace();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Unable to reject capture item.");
    } finally {
      setIsSubmitting(false);
    }
  }, [loadWorkspace]);

  const markDuplicate = useCallback(async (item: CaptureReviewItem) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const timestamp = new Date().toISOString();

      const match =
        item.duplicateTransactionId || item.duplicateCaptureReviewItemId
          ? null
          : detectCaptureDuplicate({
              candidate: item,
              existingTransactions: transactions.filter(
                (transaction) => transaction.captureReviewItemId !== item.id,
              ),
              existingReviewItems: captureReviewItems.filter((entry) => entry.id !== item.id),
            });

      const duplicateTransactionId = item.duplicateTransactionId ?? match?.transactionId;
      const duplicateCaptureReviewItemId =
        item.duplicateCaptureReviewItemId ?? match?.reviewItemId;

      const issues = validateCaptureReviewItem({
        originalAmount: item.originalAmount,
        currency: item.currency,
        fxRateToUgx: item.fxRateToUgx,
        duplicateTransactionId,
      });
      if (!duplicateTransactionId) {
        issues.push(MANUAL_DUPLICATE_ISSUE);
      }

      await repositories.captureReviewItems.upsert({
        ...item,
        duplicateTransactionId,
        duplicateCaptureReviewItemId,
        issues,
        status: "duplicate",
        reviewedAt: timestamp,
        updatedAt: timestamp,
      });
      await loadWorkspace();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to update duplicate state.");
    } finally {
      setIsSubmitting(false);
    }
  }, [captureReviewItems, loadWorkspace, transactions]);

  const clearDuplicate = useCallback(async (item: CaptureReviewItem) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const timestamp = new Date().toISOString();
      const issues = validateCaptureReviewItem({
        originalAmount: item.originalAmount,
        currency: item.currency,
        fxRateToUgx: item.fxRateToUgx,
        duplicateTransactionId: undefined,
      });

      await repositories.captureReviewItems.upsert({
        ...item,
        duplicateTransactionId: undefined,
        duplicateCaptureReviewItemId: undefined,
        issues,
        status: issues.length > 0 ? "needs_review" : "new",
        reviewedAt: timestamp,
        updatedAt: timestamp,
      });
      await loadWorkspace();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Unable to clear duplicate state.");
    } finally {
      setIsSubmitting(false);
    }
  }, [loadWorkspace]);

  return {
    profile,
    accounts,
    categories,
    transactions,
    periodTransactions,
    periodSummary,
    captureReviewItems,
    openCaptureReviewItems,
    isLoading,
    isSubmitting,
    error,
    updateItem,
    approveItem,
    rejectItem,
    markDuplicate,
    clearDuplicate,
  };
}
