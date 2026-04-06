"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import { announceLocalSave } from "@/lib/local-save";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { applyTransactionRules } from "@/lib/domain/rules";
import { getSummaryForTransactions } from "@/lib/domain/summaries";
import {
  buildTransactionFromCaptureReviewItem,
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

const repositories = createIndexedDbRepositories();

function sortByUpdatedAt(items: CaptureReviewItem[]) {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
  const currentPeriod = new Date().toISOString().slice(0, 7);

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
      setError(loadError instanceof Error ? loadError.message : "Unable to load capture inbox.");
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
      await repositories.captureReviewItems.upsert({
        ...item,
        normalizedAmount,
        issues,
        status: item.duplicateTransactionId ? "duplicate" : issues.length > 0 ? "needs_review" : "new",
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

      await repositories.transactions.upsert(proposed);
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
  }, [loadWorkspace, profile, transactionRules]);

  const rejectItem = useCallback(async (item: CaptureReviewItem) => {
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
      await repositories.captureReviewItems.upsert({
        ...item,
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
  };
}
