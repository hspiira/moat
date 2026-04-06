"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import { announceLocalSave } from "@/lib/local-save";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type {
  Account,
  BudgetTarget,
  Category,
  MonthClose,
  RecurringObligation,
  Transaction,
  TransactionRule,
  UserProfile,
} from "@/lib/types";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { evaluateRecurringObligations } from "@/lib/domain/recurring";
import {
  buildMonthCloseRecord,
  evaluateMonthClose,
  type MonthCloseEvaluation,
} from "@/lib/domain/reconciliation";
import { applyTransactionRules } from "@/lib/domain/rules";
import { getSummaryForTransactions } from "@/lib/domain/summaries";

import {
  categoryMatchesType,
  defaultTransactionForm,
  type TransactionFormState,
} from "./transaction-form";

const repositories = createIndexedDbRepositories();

export type BudgetFormState = {
  categoryId: string;
  targetAmount: string;
  rolloverAmount: string;
};

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
    payee: "",
  };
}

export function useTransactionsWorkspace() {
  const closePeriod = new Date().toISOString().slice(0, 7);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetTarget[]>([]);
  const [transactionRules, setTransactionRules] = useState<TransactionRule[]>([]);
  const [recurringObligations, setRecurringObligations] = useState<RecurringObligation[]>([]);
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
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>({
    categoryId: "",
    targetAmount: "",
    rolloverAmount: "",
  });
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const recurringEvaluations = useMemo(
    () => evaluateRecurringObligations(recurringObligations, transactions, closePeriod),
    [closePeriod, recurringObligations, transactions],
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
      const [storedRules, storedObligations, storedMonthClose, storedBudgets] = await Promise.all([
        repositories.transactionRules.listByUser(nextProfile.id),
        repositories.recurringObligations.listByUser(nextProfile.id),
        repositories.monthCloses.getByPeriod(nextProfile.id, closePeriod),
        repositories.budgets.listByMonth(nextProfile.id, closePeriod),
      ]);

      const reconciledAccounts = reconcileAccountBalances(storedAccounts, storedTransactions);
      await Promise.all(reconciledAccounts.map((account) => repositories.accounts.upsert(account)));

      setAccounts(reconciledAccounts);
      setCategories(storedCategories);
      setTransactions(sortTransactions(storedTransactions));
      setBudgets(storedBudgets);
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
  }, [closePeriod]);

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, [loadWorkspace]);

  const refreshAccounts = useCallback(async (userId: string) => {
    const storedAccounts = await repositories.accounts.listByUser(userId);
    const storedTransactions = await repositories.transactions.listByUser(userId);
    const reconciled = reconcileAccountBalances(storedAccounts, storedTransactions);
    await Promise.all(reconciled.map((account) => repositories.accounts.upsert(account)));
  }, []);

  const refreshMonthCloseState = useCallback(
    async (userId: string) => {
      const [storedTransactions, storedCategories, storedObligations, existingMonthClose] =
        await Promise.all([
          repositories.transactions.listByUser(userId),
          repositories.categories.listByUser(userId),
          repositories.recurringObligations.listByUser(userId),
          repositories.monthCloses.getByPeriod(userId, closePeriod),
        ]);
      const nextRecurringEvaluations = evaluateRecurringObligations(
        storedObligations,
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
      setRecurringObligations(storedObligations);
      setMonthClose(nextRecord);
      setMonthCloseEvaluation(evaluation);
    },
    [closePeriod],
  );

  const handleTransactionSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const timestamp = new Date().toISOString();
        const amount = Number(transactionForm.amount);
        const wasEditing = Boolean(editingTransactionId);
        const rules = await repositories.transactionRules.listByUser(profile.id);

        if (transactionForm.type === "transfer") {
          if (!transactionForm.accountId || !transactionForm.destinationAccountId) {
            throw new Error("Transfer requires a source and destination account.");
          }
          if (transactionForm.accountId === transactionForm.destinationAccountId) {
            throw new Error("Source and destination must be different accounts.");
          }

          const transferGroupId =
            editingTransactionId?.split(":")[0] ?? `transfer:${crypto.randomUUID()}`;
          const sourceId = `${transferGroupId}:source`;
          const destinationId = `${transferGroupId}:destination`;

          await Promise.all([
            repositories.transactions.upsert({
              id: sourceId,
              userId: profile.id,
              accountId: transactionForm.accountId,
              type: "transfer",
              amount: -Math.abs(amount),
              currency: "UGX",
              originalAmount: Math.abs(amount),
              occurredOn: transactionForm.occurredOn,
              categoryId: transactionForm.categoryId,
              payee: transactionForm.payee.trim() || undefined,
              rawPayee: transactionForm.payee.trim() || undefined,
              note: transactionForm.note.trim() || undefined,
              reconciliationState: "posted",
              source: "manual",
              transferGroupId,
              createdAt: transactions.find((transaction) => transaction.id === sourceId)?.createdAt ?? timestamp,
              updatedAt: timestamp,
            }),
            repositories.transactions.upsert({
              id: destinationId,
              userId: profile.id,
              accountId: transactionForm.destinationAccountId,
              type: "transfer",
              amount: Math.abs(amount),
              currency: "UGX",
              originalAmount: Math.abs(amount),
              occurredOn: transactionForm.occurredOn,
              categoryId: transactionForm.categoryId,
              payee: transactionForm.payee.trim() || undefined,
              rawPayee: transactionForm.payee.trim() || undefined,
              note: transactionForm.note.trim() || undefined,
              reconciliationState: "posted",
              source: "manual",
              transferGroupId,
              createdAt:
                transactions.find((transaction) => transaction.id === destinationId)?.createdAt ??
                timestamp,
              updatedAt: timestamp,
            }),
          ]);
        } else {
          const transactionId = editingTransactionId ?? `transaction:${crypto.randomUUID()}`;
          const baseTransaction: Transaction = {
            id: transactionId,
            userId: profile.id,
            accountId: transactionForm.accountId,
            type: transactionForm.type,
            amount: Math.abs(amount),
            currency: "UGX",
            originalAmount: Math.abs(amount),
            occurredOn: transactionForm.occurredOn,
            categoryId: transactionForm.categoryId,
            payee: transactionForm.payee.trim() || undefined,
            rawPayee: transactionForm.payee.trim() || undefined,
            note: transactionForm.note.trim() || undefined,
            reconciliationState: "posted",
            source: "manual",
            reviewedAt: timestamp,
            createdAt:
              transactions.find((transaction) => transaction.id === transactionId)?.createdAt ??
              timestamp,
            updatedAt: timestamp,
          };
          const proposed =
            applyTransactionRules(baseTransaction, rules)?.proposedTransaction ?? baseTransaction;

          await repositories.transactions.upsert(proposed);
        }

        await refreshAccounts(profile.id);
        await refreshMonthCloseState(profile.id);
        const message = wasEditing ? "Transaction updated locally" : "Transaction saved locally";
        setLastSavedAt(timestamp);
        setSuccessMessage(message);
        announceLocalSave({ entity: "transactions", savedAt: timestamp, message });
        setEditingTransactionId(null);
        setTransactionForm(getResetTransactionForm(accounts, categories));
        await loadWorkspace();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Unable to save transaction.");
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
      refreshAccounts,
      refreshMonthCloseState,
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
      payee: transaction.payee ?? transaction.rawPayee ?? "",
      amount: String(transaction.amount),
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
        await refreshAccounts(profile.id);
        await refreshMonthCloseState(profile.id);
        await loadWorkspace();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Unable to delete transaction.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      editingTransactionId,
      loadWorkspace,
      profile,
      refreshAccounts,
      refreshMonthCloseState,
      transactions,
    ],
  );

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
        await loadWorkspace();
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadWorkspace, profile],
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
        await loadWorkspace();
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadWorkspace],
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
        await refreshMonthCloseState(profile.id);
        await loadWorkspace();
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadWorkspace, profile, refreshMonthCloseState],
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
          await refreshMonthCloseState(profile.id);
        }
        await loadWorkspace();
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadWorkspace, profile, refreshMonthCloseState],
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
    } finally {
      setIsSubmitting(false);
    }
  }, [closePeriod, loadWorkspace, monthClose, monthCloseEvaluation, profile]);

  const exportMonthClose = useCallback(() => {
    const periodTransactions = transactions.filter((transaction) =>
      transaction.occurredOn.startsWith(closePeriod),
    );
    const summary = getSummaryForTransactions(periodTransactions, categories);
    const csvLines = [
      ["Metric", "Value"].join(","),
      ["Opening balance", String(summary.openingBalance)].join(","),
      ["Inflow", String(summary.inflow)].join(","),
      ["Outflow", String(summary.outflow)].join(","),
      ["Saved", String(summary.savings)].join(","),
      ["Allocated savings", String(summary.allocatedSavings)].join(","),
      ["Movement", String(summary.movement)].join(","),
      ["Closing balance", String(summary.closingBalance)].join(","),
      "",
      ["Date", "Type", "Account", "Category", "Payee", "Amount", "State", "Note"].join(","),
      ...periodTransactions.map((transaction) =>
        [
          transaction.occurredOn,
          transaction.type,
          transaction.accountId,
          transaction.categoryId,
          transaction.payee ?? transaction.rawPayee ?? "",
          String(transaction.amount),
          transaction.reconciliationState,
          (transaction.note ?? "").replaceAll(",", " "),
        ].join(","),
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `month-close-${closePeriod}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [categories, closePeriod, transactions]);

  const saveBudget = useCallback(async () => {
    if (!profile || !budgetForm.categoryId) return;
    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const existing = budgets.find((budget) => budget.categoryId === budgetForm.categoryId);
      await repositories.budgets.upsert({
        id: existing?.id ?? `budget:${closePeriod}:${budgetForm.categoryId}`,
        userId: profile.id,
        month: closePeriod,
        categoryId: budgetForm.categoryId,
        targetAmount: Number(budgetForm.targetAmount) || 0,
        rolloverAmount: Number(budgetForm.rolloverAmount) || 0,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
      setBudgetForm((current) => ({
        ...current,
        targetAmount: "",
        rolloverAmount: "",
      }));
      await loadWorkspace();
    } finally {
      setIsSubmitting(false);
    }
  }, [budgetForm, budgets, closePeriod, loadWorkspace, profile]);

  return {
    closePeriod,
    profile,
    accounts,
    categories,
    transactions,
    budgets,
    transactionRules,
    recurringObligations,
    recurringEvaluations,
    monthClose,
    monthCloseEvaluation,
    transactionForm,
    budgetForm,
    editingTransactionId,
    isLoading,
    isSubmitting,
    error,
    lastSavedAt,
    successMessage,
    setError,
    setTransactionForm,
    setBudgetForm,
    loadWorkspace,
    refreshMonthCloseState,
    handleTransactionSubmit,
    beginTransactionEdit,
    handleDeleteTransaction,
    saveRule,
    toggleRule,
    saveObligation,
    toggleObligation,
    closeMonth,
    exportMonthClose,
    saveBudget,
    cancelEdit: () => {
      setEditingTransactionId(null);
      setTransactionForm(getResetTransactionForm(accounts, categories));
    },
  };
}
