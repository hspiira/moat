"use client";

// Orchestrates the main transactions workspace: loads ledger data, handles
// capture intake, and derives month-close state for the UI. Budget and
// rule/obligation slices live in their own hooks; transaction construction
// and the month-close CSV are pure modules with their own tests.

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { announceLocalSave } from "@/lib/local-save";
import { repositories } from "@/lib/repositories/instance";
import { persistReviewedCaptureCandidates } from "@/lib/capture/persistence";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import { getOpenCaptureReviewItems } from "@/lib/capture/review-queue";
import {
  getRememberedFxDefault,
  normalizePayeeKey,
  saveFxMemory,
} from "@/lib/preferences/fx-memory";
import { readDebtPlannerSettings } from "@/lib/preferences/debt-planner";
import type {
  Account,
  CaptureReviewItem,
  Category,
  MonthClose,
  Transaction,
  UserProfile,
} from "@/lib/types";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import {
  buildSuggestedRecurringObligations,
  evaluateRecurringObligations,
} from "@/lib/domain/recurring";
import {
  buildMonthCloseRecord,
  evaluateMonthClose,
  type MonthCloseEvaluation,
} from "@/lib/domain/reconciliation";
import { getSummaryForTransactions } from "@/lib/domain/summaries";

import {
  categoryMatchesType,
  defaultTransactionForm,
  type TransactionFormState,
} from "./transaction-form";
import type { CaptureIntent } from "./capture-intent-panel";
import { buildManualTransaction, buildTransferPair } from "./transaction-builder";
import { buildMonthCloseCsv } from "./month-close-export";
import { useBudgetPlanner, type BudgetFormState } from "./use-budget-planner";
import { useRulesAndObligations } from "./use-rules-and-obligations";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";

export type { BudgetFormState };

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => {
    if (a.occurredOn === b.occurredOn) return b.createdAt.localeCompare(a.createdAt);
    return b.occurredOn.localeCompare(a.occurredOn);
  });
}

function getResetTransactionForm(
  accounts: Account[],
  categories: Category[],
): TransactionFormState {
  return {
    ...defaultTransactionForm,
    accountId: accounts[0]?.id ?? "",
    destinationAccountId: accounts[1]?.id ?? "",
    categoryId:
      categories.find((category) => categoryMatchesType(category, defaultTransactionForm.type))
        ?.id ?? "",
    currency: "UGX",
    payee: "",
    fxRateToUgx: "",
  };
}

export function useTransactionsWorkspace() {
  const searchParams = useSearchParams();
  const { show } = useToast();
  const closePeriod = new Date().toISOString().slice(0, 7);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [captureReviewItems, setCaptureReviewItems] = useState<CaptureReviewItem[]>([]);
  const [monthClose, setMonthClose] = useState<MonthClose | null>(null);
  const [monthCloseEvaluation, setMonthCloseEvaluation] = useState<MonthCloseEvaluation>({
    unresolvedTransactions: [],
    duplicateGroups: [],
    missingCategoryTransactions: [],
    recurringDueCount: 0,
    recurringMissingCount: 0,
    isReadyToClose: false,
  });
  const [transactionForm, setTransactionForm] =
    useState<TransactionFormState>(defaultTransactionForm);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rememberedFxHint, setRememberedFxHint] = useState<string | null>(null);
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent>(null);
  const [sharedCaptureInput, setSharedCaptureInput] = useState("");
  const debtPlannerSettings = useMemo(() => readDebtPlannerSettings(), []);

  const refreshMonthCloseState = useCallback(
    async (userId: string) => {
      const [storedAccounts, storedTransactions, storedCategories, storedObligations, existingMonthClose] =
        await Promise.all([
          repositories.accounts.listByUser(userId),
          repositories.transactions.listByUser(userId),
          repositories.categories.listByUser(userId),
          repositories.recurringObligations.listByUser(userId),
          repositories.monthCloses.getByPeriod(userId, closePeriod),
        ]);
      const nextRecurringEvaluations = evaluateRecurringObligations(
        [
          ...storedObligations,
          ...buildSuggestedRecurringObligations(
            storedAccounts,
            storedTransactions,
            debtPlannerSettings.strategy,
            debtPlannerSettings.extraMonthlyPayment,
          ),
        ],
        storedTransactions,
        closePeriod,
      );
      const evaluation = evaluateMonthClose(
        storedTransactions.filter((transaction) => transaction.occurredOn.startsWith(closePeriod)),
        storedCategories,
        nextRecurringEvaluations.map((entry) => ({
          obligation: entry.obligation,
          status:
            entry.state === "paid" ? "paid" : entry.state === "partial" ? "partial" : "missing",
        })),
      );
      const nextRecord = buildMonthCloseRecord(existingMonthClose, userId, closePeriod, evaluation);
      await repositories.monthCloses.upsert(nextRecord);
      setMonthClose(nextRecord);
      setMonthCloseEvaluation(evaluation);
    },
    [closePeriod, debtPlannerSettings.extraMonthlyPayment, debtPlannerSettings.strategy],
  );

  const budgetPlanner = useBudgetPlanner({
    profile,
    categories,
    closePeriod,
    onMutated: () => loadWorkspaceRef.current(),
    setIsSubmitting,
  });
  const rulesAndObligations = useRulesAndObligations({
    profile,
    onMutated: () => loadWorkspaceRef.current(),
    onObligationsChanged: refreshMonthCloseState,
    setIsSubmitting,
  });
  const { setBudgets, setBudgetForm } = budgetPlanner;
  const { setTransactionRules, setRecurringObligations } = rulesAndObligations;

  const suggestedRecurringObligations = useMemo(
    () =>
      buildSuggestedRecurringObligations(
        accounts,
        transactions,
        debtPlannerSettings.strategy,
        debtPlannerSettings.extraMonthlyPayment,
      ),
    [accounts, debtPlannerSettings.extraMonthlyPayment, debtPlannerSettings.strategy, transactions],
  );

  const recurringEvaluations = useMemo(
    () =>
      evaluateRecurringObligations(
        [...rulesAndObligations.recurringObligations, ...suggestedRecurringObligations],
        transactions,
        closePeriod,
      ),
    [closePeriod, rulesAndObligations.recurringObligations, suggestedRecurringObligations, transactions],
  );

  const periodTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.occurredOn.startsWith(closePeriod)),
    [closePeriod, transactions],
  );

  const periodSummary = useMemo(
    () => getSummaryForTransactions(periodTransactions, categories),
    [categories, periodTransactions],
  );

  const reviewCount = useMemo(
    () =>
      periodTransactions.filter(
        (transaction) =>
          transaction.reconciliationState === "draft" ||
          transaction.reconciliationState === "parsed" ||
          transaction.reconciliationState === "reviewed",
      ).length,
    [periodTransactions],
  );

  const captureReviewCount = useMemo(
    () => getOpenCaptureReviewItems(captureReviewItems).length,
    [captureReviewItems],
  );

  const duplicateCount = useMemo(
    () => monthCloseEvaluation.duplicateGroups.length,
    [monthCloseEvaluation.duplicateGroups.length],
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
        setBudgets([]);
        setCaptureReviewItems([]);
        setTransactionRules([]);
        setRecurringObligations([]);
        setMonthClose(null);
        return;
      }

      const [storedAccounts, storedCategories, storedTransactions] = await Promise.all([
        repositories.accounts.listByUser(nextProfile.id),
        repositories.categories.listByUser(nextProfile.id),
        repositories.transactions.listByUser(nextProfile.id),
      ]);
      const [storedCaptureReviewItems, storedRules, storedObligations, storedMonthClose, storedBudgets] = await Promise.all([
        repositories.captureReviewItems.listByUser(nextProfile.id),
        repositories.transactionRules.listByUser(nextProfile.id),
        repositories.recurringObligations.listByUser(nextProfile.id),
        repositories.monthCloses.getByPeriod(nextProfile.id, closePeriod),
        repositories.budgets.listByMonth(nextProfile.id, closePeriod),
      ]);

      // Reconcile in memory for display only. Loading is a read — persisting
      // balances here would churn storage and the sync outbox on every view.
      const reconciledAccounts = reconcileAccountBalances(storedAccounts, storedTransactions);

      setAccounts(reconciledAccounts);
      setCategories(storedCategories);
      setTransactions(sortTransactions(storedTransactions));
      setBudgets(storedBudgets);
      setCaptureReviewItems(storedCaptureReviewItems);
      setTransactionRules(storedRules);
      setRecurringObligations(storedObligations);
      setMonthClose(storedMonthClose);

      const nextRecurringEvaluations = evaluateRecurringObligations(
        storedObligations,
        storedTransactions,
        closePeriod,
      );
      setMonthCloseEvaluation(
        evaluateMonthClose(
          storedTransactions.filter((transaction) => transaction.occurredOn.startsWith(closePeriod)),
          storedCategories,
          nextRecurringEvaluations.map((evaluation) => ({
            obligation: evaluation.obligation,
            status:
              evaluation.state === "paid"
                ? "paid"
                : evaluation.state === "partial"
                  ? "partial"
                  : "missing",
          })),
        ),
      );

      setTransactionForm((current) => ({
        ...getResetTransactionForm(reconciledAccounts, storedCategories),
        ...current,
        accountId: current.accountId || reconciledAccounts[0]?.id || "",
        destinationAccountId: current.destinationAccountId || reconciledAccounts[1]?.id || "",
        categoryId:
          current.categoryId ||
          storedCategories.find((category) => categoryMatchesType(category, current.type))?.id ||
          "",
      }));
      setBudgetForm((current) => ({
        ...current,
        categoryId:
          current.categoryId ||
          storedCategories.find((category) => category.kind === "expense")?.id ||
          "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load transactions.");
    } finally {
      setIsLoading(false);
    }
  }, [closePeriod, setBudgetForm, setBudgets, setRecurringObligations, setTransactionRules]);

  // Stable indirection so the sub-hooks can trigger a reload without a
  // circular dependency between hook definitions.
  const loadWorkspaceRef = useLatest(loadWorkspace);

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, [loadWorkspace]);

  useEffect(() => {
    const capture = searchParams.get("capture");
    const type = searchParams.get("type");
    const accountId = searchParams.get("accountId");
    const amount = searchParams.get("amount");
    const payee = searchParams.get("payee");
    const sharedTitle = searchParams.get("title");
    const sharedText = searchParams.get("text");
    const sharedUrl = searchParams.get("url");
    const nextSharedInput = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join("\n");
    const nextCaptureIntent: CaptureIntent =
      capture === "expense" ||
      capture === "income" ||
      capture === "transfer" ||
      capture === "import" ||
      capture === "text"
        ? capture
        : nextSharedInput
          ? "text"
          : null;

    setCaptureIntent(nextCaptureIntent);
    setSharedCaptureInput(nextSharedInput);

    if (!capture && !type && !accountId && !amount && !payee && !nextSharedInput) return;

    setTransactionForm((current) => ({
      ...current,
      type: (type as TransactionFormState["type"]) || current.type,
      accountId: accountId || current.accountId,
      amount: amount || current.amount,
      payee: payee || current.payee,
      categoryId:
        categories.find((category) =>
          categoryMatchesType(category, (type as TransactionFormState["type"]) || current.type),
        )?.id ?? current.categoryId,
    }));
  }, [categories, searchParams]);

  useEffect(() => {
    if (transactionForm.currency === "UGX") {
      setRememberedFxHint(null);
      return;
    }

    const payee = transactionForm.payee.trim();
    if (!payee) {
      setRememberedFxHint(null);
      return;
    }

    const memory = getRememberedFxDefault(payee, transactionForm.currency);
    if (!memory) {
      setRememberedFxHint(null);
      return;
    }

    setRememberedFxHint(memory.hint);
    setTransactionForm((current) => {
      if (current.fxRateToUgx) return current;
      if (current.currency !== memory.currency) return current;
      if (normalizePayeeKey(current.payee) !== memory.payeeKey) return current;
      return { ...current, fxRateToUgx: String(memory.rateToUgx) };
    });
  }, [transactionForm.currency, transactionForm.payee]);

  /**
   * Persists reconciled balances after a ledger mutation. Only accounts
   * whose stored balance actually changed are written, so the sync outbox
   * is not flooded with no-op upserts.
   */
  const persistReconciledBalances = useCallback(async (userId: string) => {
    const storedAccounts = await repositories.accounts.listByUser(userId);
    const storedTransactions = await repositories.transactions.listByUser(userId);
    const reconciled = reconcileAccountBalances(storedAccounts, storedTransactions);
    const storedBalances = new Map(storedAccounts.map((account) => [account.id, account.balance]));
    const changed = reconciled.filter(
      (account) => storedBalances.get(account.id) !== account.balance,
    );
    await Promise.all(changed.map((account) => repositories.accounts.upsert(account)));
  }, []);

  const handleTransactionSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const timestamp = new Date().toISOString();
        const wasEditing = Boolean(editingTransactionId);
        const buildInput = {
          form: transactionForm,
          userId: profile.id,
          timestamp,
          editingTransactionId,
          existingTransactions: transactions,
        };

        if (transactionForm.type === "transfer") {
          const [source, destination] = buildTransferPair(buildInput);
          await Promise.all([
            repositories.transactions.upsert(source),
            repositories.transactions.upsert(destination),
          ]);
        } else {
          const rules = await repositories.transactionRules.listByUser(profile.id);
          await repositories.transactions.upsert(buildManualTransaction(buildInput, rules));
        }

        await persistReconciledBalances(profile.id);
        await refreshMonthCloseState(profile.id);
        if (transactionForm.currency !== "UGX" && transactionForm.payee.trim()) {
          saveFxMemory({
            payeeKey: normalizePayeeKey(transactionForm.payee),
            displayPayee: transactionForm.payee.trim(),
            currency: transactionForm.currency,
            rateToUgx: Number(transactionForm.fxRateToUgx),
            updatedAt: timestamp,
          });
        }
        const message = wasEditing ? "Transaction updated locally" : "Transaction saved locally";
        setLastSavedAt(timestamp);
        setSuccessMessage(message);
        announceLocalSave({ entity: "transactions", savedAt: timestamp, message });
        show(wasEditing ? "Transaction updated." : "Transaction saved.", "success");
        setEditingTransactionId(null);
        setTransactionForm(getResetTransactionForm(accounts, categories));
        await loadWorkspace();
      } catch (submitError) {
        const message = errorMessage(submitError, "Couldn't save the transaction.");
        setError(message);
        show(message, "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      accounts,
      categories,
      editingTransactionId,
      loadWorkspace,
      persistReconciledBalances,
      profile,
      refreshMonthCloseState,
      show,
      transactionForm,
      transactions,
    ],
  );

  const beginTransactionEdit = useCallback((transaction: Transaction) => {
    if (transaction.type === "transfer") return;
    setEditingTransactionId(transaction.id);
    setTransactionForm({
      type: transaction.type,
      accountId: transaction.accountId,
      destinationAccountId: "",
      categoryId: transaction.categoryId,
      currency: transaction.currency,
      payee: transaction.payee ?? transaction.rawPayee ?? "",
      amount: String(transaction.originalAmount),
      fxRateToUgx: transaction.fxRateToUgx ? String(transaction.fxRateToUgx) : "",
      occurredOn: transaction.occurredOn,
      note: transaction.note ?? "",
    });
  }, []);

  const handleDeleteTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!profile) return;
      setIsSubmitting(true);
      setError(null);

      try {
        if (transaction.transferGroupId) {
          const linked = transactions.filter(
            (entry) => entry.transferGroupId === transaction.transferGroupId,
          );
          await Promise.all(linked.map((entry) => repositories.transactions.remove(entry.id)));
        } else {
          await repositories.transactions.remove(transaction.id);
        }

        if (editingTransactionId === transaction.id) {
          setEditingTransactionId(null);
          setTransactionForm(defaultTransactionForm);
        }

        const timestamp = new Date().toISOString();
        const message = "Transaction deleted locally";
        setLastSavedAt(timestamp);
        setSuccessMessage(message);
        announceLocalSave({ entity: "transactions", savedAt: timestamp, message });
        show("Transaction deleted.", "success");
        await persistReconciledBalances(profile.id);
        await refreshMonthCloseState(profile.id);
        await loadWorkspace();
      } catch (deleteError) {
        const message = errorMessage(deleteError, "Couldn't delete the transaction.");
        setError(message);
        show(message, "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      editingTransactionId,
      loadWorkspace,
      persistReconciledBalances,
      profile,
      refreshMonthCloseState,
      show,
      transactions,
    ],
  );

  const saveCapturedTransactions = useCallback(
    async (candidates: ParsedCaptureCandidate[]) => {
      if (!profile || candidates.length === 0) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const result = await persistReviewedCaptureCandidates({
          repositories,
          userId: profile.id,
          candidates,
          source: sharedCaptureInput.trim() ? "shared_text" : "pasted_text",
        });
        await refreshMonthCloseState(profile.id);
        const message = "Captured items sent to review locally";
        setLastSavedAt(result.savedAt);
        setSuccessMessage(message);
        await loadWorkspace();
      } catch (captureError) {
        setError(
          captureError instanceof Error ? captureError.message : "Unable to save captured transactions.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadWorkspace, profile, refreshMonthCloseState, sharedCaptureInput],
  );

  const closeMonth = useCallback(async () => {
    if (!profile || !monthCloseEvaluation.isReadyToClose) return;
    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      await repositories.monthCloses.upsert({
        ...(monthClose ?? buildMonthCloseRecord(null, profile.id, closePeriod, monthCloseEvaluation)),
        state: "closed",
        closedAt: timestamp,
        updatedAt: timestamp,
      });
      await loadWorkspace();
      show(`${closePeriod} closed.`, "success");
    } catch (closeError) {
      show(errorMessage(closeError, "Couldn't close the month."), "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [closePeriod, loadWorkspace, monthClose, monthCloseEvaluation, profile, show]);

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
    closePeriod,
    profile,
    accounts,
    categories,
    transactions,
    periodTransactions,
    periodSummary,
    reviewCount,
    captureReviewCount,
    duplicateCount,
    budgets: budgetPlanner.budgets,
    captureReviewItems,
    transactionRules: rulesAndObligations.transactionRules,
    recurringObligations: rulesAndObligations.recurringObligations,
    recurringEvaluations,
    monthClose,
    monthCloseEvaluation,
    transactionForm,
    budgetForm: budgetPlanner.budgetForm,
    editingTransactionId,
    isLoading,
    isSubmitting,
    error,
    lastSavedAt,
    successMessage,
    rememberedFxHint,
    captureIntent,
    sharedCaptureInput,
    setError,
    setTransactionForm,
    setBudgetForm,
    loadWorkspace,
    refreshMonthCloseState,
    handleTransactionSubmit,
    beginTransactionEdit,
    handleDeleteTransaction,
    saveCapturedTransactions,
    saveRule: rulesAndObligations.saveRule,
    toggleRule: rulesAndObligations.toggleRule,
    saveObligation: rulesAndObligations.saveObligation,
    toggleObligation: rulesAndObligations.toggleObligation,
    closeMonth,
    exportMonthClose,
    saveBudget: budgetPlanner.saveBudget,
    editBudget: budgetPlanner.editBudget,
    deleteBudget: budgetPlanner.deleteBudget,
    cancelEdit: () => {
      setEditingTransactionId(null);
      setTransactionForm(getResetTransactionForm(accounts, categories));
    },
    cancelBudgetEdit: budgetPlanner.cancelBudgetEdit,
  };
}
