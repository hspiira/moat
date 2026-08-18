"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { announceLocalSave } from "@/lib/local-save";
import { repositories } from "@/lib/repositories/instance";
import { persistReviewedCaptureCandidates } from "@/lib/capture/persistence";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import { getOpenCaptureReviewItems } from "@/lib/capture/review-queue";
import { normalizePayeeKey, saveFxMemory } from "@/lib/preferences/fx-memory";
import { readDebtPlannerSettings } from "@/lib/preferences/debt-planner";
import type {
  Account,
  CaptureReviewItem,
  Category,
  CategoryKind,
  Transaction,
  TransactionLineItem,
  UserProfile,
} from "@/lib/types";
import { describeTransferCounterparty } from "@/lib/domain/transfer-counterparty";
import {
  buildSuggestedRecurringObligations,
  evaluateRecurringObligations,
} from "@/lib/domain/recurring";
import { getUnresolvedTransactions } from "@/lib/domain/reconciliation";
import { getSummaryForTransactions } from "@/lib/domain/summaries";

import { categoryMatchesType } from "@/lib/domain/transaction-classification";
import { findCategoryByName } from "@/lib/domain/category-merge";
import { countCategoryUsage } from "@/lib/domain/category-usage";
import { currentMonthIso } from "@/lib/today";
import { isReservedAccount } from "@/lib/domain/reserved-accounts";
import { buildTransactionEdit } from "./transaction-edit-form";
import { useTransactionFormSync } from "./use-transaction-form-sync";
import { createDefaultTransactionForm, type TransactionFormState } from "./transaction-form";
import { useCounterparties } from "./use-counterparties";
import { useLineItems } from "./use-line-items";
import { useMonthClose } from "./use-month-close";
import { evaluateMonth } from "@/lib/domain/month-evaluation";
import { planTransactionWrite } from "@/lib/domain/transaction-write-plan";
import { persistReconciledBalances } from "@/lib/repositories/account-balances";
import { loadWorkspaceSnapshot } from "@/lib/repositories/workspace-snapshot";
import {
  applyTransactionDelete,
  applyTransactionWrite,
} from "@/lib/repositories/transaction-write";
import { useBudgetPlanner, type BudgetFormState } from "./use-budget-planner";
import { useRulesAndObligations } from "./use-rules-and-obligations";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { createId } from "@/lib/ids";

export type { CaptureIntent } from "./capture-intent";
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

function selectableAccounts(accounts: Account[]): Account[] {
  const spendable = accounts.filter(
    (account) => !isReservedAccount(account) && !account.isArchived,
  );
  return spendable.length > 0 ? spendable : accounts;
}

function getResetTransactionForm(
  accounts: Account[],
  categories: Category[],
): TransactionFormState {
  const base = createDefaultTransactionForm();
  const selectable = selectableAccounts(accounts);

  return {
    ...base,
    accountId: selectable[0]?.id ?? "",
    destinationAccountId: selectable[1]?.id ?? selectable[0]?.id ?? "",
    categoryId:
      categories.find((category) => categoryMatchesType(category, base.type))?.id ?? "",
    currency: "UGX",
    payee: "",
    fxRateToUgx: "",
  };
}

export function useTransactionsWorkspace() {
  const { show } = useToast();
  const closePeriod = currentMonthIso();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);
  const [pendingSyncTransactionIds, setPendingSyncTransactionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { counterparties, setCounterparties, loadAndBackfill, resolveSelection } =
    useCounterparties();
  const [captureReviewItems, setCaptureReviewItems] = useState<CaptureReviewItem[]>([]);
  const [transactionForm, setTransactionForm] =
    useState<TransactionFormState>(createDefaultTransactionForm);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const debtPlannerSettings = useMemo(() => readDebtPlannerSettings(), []);

  const {
    monthClose,
    setMonthClose,
    monthCloseEvaluation,
    setMonthCloseEvaluation,
    refreshMonthCloseState,
    closeMonth,
    exportMonthClose,
  } = useMonthClose({
    profile,
    closePeriod,
    transactions,
    categories,
    debtPlannerSettings,
    onMutated: () => loadWorkspaceRef.current(),
    setIsSubmitting,
    show,
  });

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
    () => getUnresolvedTransactions(periodTransactions).length,
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
        setLineItems([]);
        setCounterparties([]);
        setBudgets([]);
        setCaptureReviewItems([]);
        setTransactionRules([]);
        setRecurringObligations([]);
        setMonthClose(null);
        return;
      }

      const snapshot = await loadWorkspaceSnapshot({
        userId: nextProfile.id,
        closePeriod,
        timestamp: new Date().toISOString(),
        backfillCounterparties: loadAndBackfill,
      });

      setAccounts(snapshot.accounts);
      setCategories(snapshot.categories);
      setTransactions(sortTransactions(snapshot.transactions));
      setLineItems(snapshot.lineItems);
      setBudgets(snapshot.budgets);
      setCaptureReviewItems(snapshot.captureReviewItems);
      setTransactionRules(snapshot.transactionRules);
      setRecurringObligations(snapshot.recurringObligations);
      setMonthClose(snapshot.monthClose);
      setPendingSyncTransactionIds(snapshot.pendingSyncTransactionIds);

      setMonthCloseEvaluation(
        evaluateMonth({
          accounts: snapshot.accounts,
          transactions: snapshot.transactions,
          categories: snapshot.categories,
          obligations: snapshot.recurringObligations,
          closePeriod,
          debtPlannerSettings,
        }),
      );

      const defaultAccounts = selectableAccounts(snapshot.accounts);
      setTransactionForm((current) => ({
        ...getResetTransactionForm(snapshot.accounts, snapshot.categories),
        ...current,
        accountId: current.accountId || defaultAccounts[0]?.id || "",
        destinationAccountId: current.destinationAccountId || defaultAccounts[1]?.id || "",
        categoryId:
          current.categoryId ||
          snapshot.categories.find((category) => categoryMatchesType(category, current.type))?.id ||
          "",
      }));
      setBudgetForm((current) => ({
        ...current,
        categoryId:
          current.categoryId ||
          snapshot.categories.find((category) => category.kind === "expense")?.id ||
          "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load transactions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [
    closePeriod,
    debtPlannerSettings,
    loadAndBackfill,
    setBudgetForm,
    setBudgets,
    setCounterparties,
    setMonthClose,
    setMonthCloseEvaluation,
    setRecurringObligations,
    setTransactionRules,
  ]);

  const loadWorkspaceRef = useLatest(loadWorkspace);

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, [loadWorkspace]);

  const { captureIntent, sharedCaptureInput, rememberedFxHint } = useTransactionFormSync({
    form: transactionForm,
    setForm: setTransactionForm,
    categories,
    editingTransactionId,
  });

  const resolveFormCounterparty = useCallback(
    (userId: string, timestamp: string) =>
      resolveSelection({
        userId,
        timestamp,
        direction: describeTransferCounterparty(
          accounts,
          transactionForm.accountId,
          transactionForm.destinationAccountId,
        )?.direction,
        selection: transactionForm,
      }),
    [accounts, resolveSelection, transactionForm],
  );

  const handleTransactionSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const timestamp = new Date().toISOString();
        const wasEditing = Boolean(editingTransactionId);
        const isTransfer = transactionForm.type === "transfer";
        const isManual = !isTransfer && transactionForm.type !== "debt_payment";

        const plan = planTransactionWrite({
          build: {
            form: transactionForm,
            userId: profile.id,
            timestamp,
            editingTransactionId,
            existingTransactions: transactions,
          },
          accounts,
          categories,
          rules: isManual ? await repositories.transactionRules.listByUser(profile.id) : [],
          counterparty: isTransfer ? await resolveFormCounterparty(profile.id, timestamp) : null,
        });

        await applyTransactionWrite(plan, categories, profile.id);

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
        profile,
      refreshMonthCloseState,
      resolveFormCounterparty,
      show,
      transactionForm,
      transactions,
    ],
  );

  const createCategory = useCallback(
    async (name: string, kind: CategoryKind): Promise<Category | null> => {
      if (!profile) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;

      const existing = findCategoryByName(categories, trimmed, kind);
      if (existing) {
        if (!existing.isArchived) return existing;
        const revived = { ...existing, isArchived: false };
        await repositories.categories.upsert(revived);
        setCategories((current) =>
          current.map((entry) => (entry.id === revived.id ? revived : entry)),
        );
        return revived;
      }

      const category: Category = {
        id: createId(),
        userId: profile.id,
        name: trimmed,
        kind,
        isDefault: false,
        createdAt: new Date().toISOString(),
      };

      await repositories.categories.upsert(category);
      setCategories((current) => [...current, category]);
      return category;
    },
    [categories, profile],
  );

  const categoryUsage = useMemo(() => countCategoryUsage(transactions), [transactions]);

  const beginTransactionEdit = useCallback(
    (transaction: Transaction) => {
      const edit = buildTransactionEdit(transaction, transactions);
      if (!edit) return;
      setEditingTransactionId(edit.editingId);
      setTransactionForm(edit.form);
    },
    [transactions],
  );

  const handleDeleteTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!profile) return;
      setIsSubmitting(true);
      setError(null);

      try {
        const timestamp = new Date().toISOString();
        const removed = await applyTransactionDelete(
          transaction,
          transactions,
          profile.id,
          timestamp,
        );

        if (editingTransactionId && removed.has(editingTransactionId)) {
          setEditingTransactionId(null);
          setTransactionForm(createDefaultTransactionForm());
        }

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

  const { saveLineItem, deleteLineItem } = useLineItems({
    profile,
    lineItems,
    onMutated: loadWorkspace,
    setIsSubmitting,
    setError,
    show,
  });

  return {
    closePeriod,
    profile,
    accounts,
    categories,
    counterparties,
    transactions,
    lineItems,
    pendingSyncTransactionIds,
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
    createCategory,
    categoryUsage,
    beginTransactionEdit,
    handleDeleteTransaction,
    saveCapturedTransactions,
    saveRule: rulesAndObligations.saveRule,
    toggleRule: rulesAndObligations.toggleRule,
    saveObligation: rulesAndObligations.saveObligation,
    toggleObligation: rulesAndObligations.toggleObligation,
    saveLineItem,
    deleteLineItem,
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
