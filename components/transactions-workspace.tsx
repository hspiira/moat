"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { evaluateRecurringObligations } from "@/lib/domain/recurring";
import {
  buildMonthCloseRecord,
  evaluateMonthClose,
  type MonthCloseEvaluation,
} from "@/lib/domain/reconciliation";
import { applyTransactionRules } from "@/lib/domain/rules";
import { getSummaryForTransactions } from "@/lib/domain/summaries";
import { announceLocalSave } from "@/lib/local-save";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type {
  Account,
  Category,
  MonthClose,
  RecurringObligation,
  Transaction,
  TransactionRule,
  UserProfile,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

import {
  TransactionForm,
  type TransactionFormState,
  categoryMatchesType,
  defaultTransactionForm,
} from "./transactions/transaction-form";
import { CsvImportPanel } from "./transactions/csv-import-panel";
import { MonthClosePanel } from "./transactions/month-close-panel";
import { RecurringObligationsPanel } from "./transactions/recurring-obligations-panel";
import { TransactionList } from "./transactions/transaction-list";
import { TransactionRulesPanel } from "./transactions/transaction-rules-panel";

const repositories = createIndexedDbRepositories();

function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => {
    if (a.occurredOn === b.occurredOn) return b.createdAt.localeCompare(a.createdAt);
    return b.occurredOn.localeCompare(a.occurredOn);
  });
}

export function TransactionsWorkspace() {
  const closePeriod = new Date().toISOString().slice(0, 7);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        setRecurringObligations([]);
        setMonthClose(null);
        return;
      }

      const [storedAccounts, storedCategories, storedTransactions] = await Promise.all([
        repositories.accounts.listByUser(nextProfile.id),
        repositories.categories.listByUser(nextProfile.id),
        repositories.transactions.listByUser(nextProfile.id),
      ]);
      const [storedRules, storedObligations, storedMonthClose] = await Promise.all([
        repositories.transactionRules.listByUser(nextProfile.id),
        repositories.recurringObligations.listByUser(nextProfile.id),
        repositories.monthCloses.getByPeriod(nextProfile.id, closePeriod),
      ]);

      const reconciledAccounts = reconcileAccountBalances(storedAccounts, storedTransactions);
      await Promise.all(reconciledAccounts.map((a) => repositories.accounts.upsert(a)));

      setAccounts(reconciledAccounts);
      setCategories(storedCategories);
      setTransactions(sortTransactions(storedTransactions));
      setTransactionRules(storedRules);
      setRecurringObligations(storedObligations);
      setMonthClose(storedMonthClose);

      const recurringEvaluations = evaluateRecurringObligations(
        storedObligations,
        storedTransactions,
        closePeriod,
      );
      setMonthCloseEvaluation(
        evaluateMonthClose(
          storedTransactions.filter((transaction) => transaction.occurredOn.startsWith(closePeriod)),
          storedCategories,
          recurringEvaluations.map((evaluation) => ({
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

      setTransactionForm((c) => ({
        ...c,
        accountId: c.accountId || reconciledAccounts[0]?.id || "",
        destinationAccountId: c.destinationAccountId || reconciledAccounts[1]?.id || "",
        categoryId:
          c.categoryId ||
          storedCategories.find((cat) => categoryMatchesType(cat, c.type))?.id ||
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

  async function refreshAccounts(userId: string) {
    const storedAccounts = await repositories.accounts.listByUser(userId);
    const storedTransactions = await repositories.transactions.listByUser(userId);
    const reconciled = reconcileAccountBalances(storedAccounts, storedTransactions);
    await Promise.all(reconciled.map((a) => repositories.accounts.upsert(a)));
  }

  async function refreshMonthCloseState(userId: string) {
    const [storedTransactions, storedCategories, storedObligations, existingMonthClose] =
      await Promise.all([
        repositories.transactions.listByUser(userId),
        repositories.categories.listByUser(userId),
        repositories.recurringObligations.listByUser(userId),
        repositories.monthCloses.getByPeriod(userId, closePeriod),
      ]);
    const recurringEvaluations = evaluateRecurringObligations(
      storedObligations,
      storedTransactions,
      closePeriod,
    );
    const evaluation = evaluateMonthClose(
      storedTransactions.filter((transaction) => transaction.occurredOn.startsWith(closePeriod)),
      storedCategories,
      recurringEvaluations.map((entry) => ({
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
  }

  async function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>) {
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
        const destId = `${transferGroupId}:destination`;

        await Promise.all([
          repositories.transactions.upsert({
            id: sourceId,
            userId: profile.id,
            accountId: transactionForm.accountId,
            type: "transfer",
            amount: -Math.abs(amount),
            occurredOn: transactionForm.occurredOn,
            categoryId: transactionForm.categoryId,
            payee: transactionForm.payee.trim() || undefined,
            rawPayee: transactionForm.payee.trim() || undefined,
            note: transactionForm.note.trim() || undefined,
            reconciliationState: "posted",
            source: "manual",
            transferGroupId,
            createdAt: transactions.find((t) => t.id === sourceId)?.createdAt ?? timestamp,
            updatedAt: timestamp,
          }),
          repositories.transactions.upsert({
            id: destId,
            userId: profile.id,
            accountId: transactionForm.destinationAccountId,
            type: "transfer",
            amount: Math.abs(amount),
            occurredOn: transactionForm.occurredOn,
            categoryId: transactionForm.categoryId,
            payee: transactionForm.payee.trim() || undefined,
            rawPayee: transactionForm.payee.trim() || undefined,
            note: transactionForm.note.trim() || undefined,
            reconciliationState: "posted",
            source: "manual",
            transferGroupId,
            createdAt: transactions.find((t) => t.id === destId)?.createdAt ?? timestamp,
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
          occurredOn: transactionForm.occurredOn,
          categoryId: transactionForm.categoryId,
          payee: transactionForm.payee.trim() || undefined,
          rawPayee: transactionForm.payee.trim() || undefined,
          note: transactionForm.note.trim() || undefined,
          reconciliationState: "posted",
          source: "manual",
          reviewedAt: timestamp,
          createdAt: transactions.find((t) => t.id === transactionId)?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        const proposed =
          applyTransactionRules(baseTransaction, rules)?.proposedTransaction ?? baseTransaction;

        await repositories.transactions.upsert(proposed);
      }

      await refreshAccounts(profile.id);
      await refreshMonthCloseState(profile.id);
      const message = wasEditing
        ? "Transaction updated locally"
        : "Transaction saved locally";
      setLastSavedAt(timestamp);
      setSuccessMessage(message);
      announceLocalSave({ entity: "transactions", savedAt: timestamp, message });
      setEditingTransactionId(null);
      setTransactionForm({
        ...defaultTransactionForm,
        accountId: accounts[0]?.id ?? "",
        destinationAccountId: accounts[1]?.id ?? "",
        categoryId:
          categories.find((c) => categoryMatchesType(c, defaultTransactionForm.type))?.id ?? "",
        payee: "",
      });
      await loadWorkspace();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save transaction.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginTransactionEdit(transaction: Transaction) {
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
  }

  async function handleDeleteTransaction(transaction: Transaction) {
    if (!profile) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (transaction.transferGroupId) {
        const linked = transactions.filter(
          (t) => t.transferGroupId === transaction.transferGroupId,
        );
        await Promise.all(linked.map((t) => repositories.transactions.remove(t.id)));
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
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete transaction.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Record income, expenses, transfers, and savings in one clean stream.
          </p>
        </div>
        {transactions.length > 0 ? (
          <div className="moat-panel-yellow border border-border/20 px-4 py-3 text-right text-sm text-muted-foreground">
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              {transactions.length}
            </div>
            <div className="text-xs">recorded</div>
          </div>
        ) : null}
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading transactions...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !profile ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Complete onboarding and add at least one account before recording transactions.{" "}
            <a href="/onboarding" className="underline underline-offset-4 hover:text-foreground">
              Get started
            </a>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && profile ? (
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <TransactionForm
              accounts={accounts}
              categories={categories}
              form={transactionForm}
              editingId={editingTransactionId}
              isSubmitting={isSubmitting}
              lastSavedAt={lastSavedAt}
              successMessage={successMessage}
              onFormChange={setTransactionForm}
              onSubmit={(e) => void handleTransactionSubmit(e)}
              onCancelEdit={() => {
                setEditingTransactionId(null);
                setTransactionForm(defaultTransactionForm);
              }}
            />

            <div className="grid gap-5 content-start">
              <CsvImportPanel
                accounts={accounts}
                categories={categories}
                transactions={transactions}
                profile={profile}
                onImportSuccess={() => void loadWorkspace()}
                onError={setError}
              />

              <TransactionList
                accounts={accounts}
                categories={categories}
                transactions={transactions}
                isSubmitting={isSubmitting}
                onEdit={beginTransactionEdit}
                onDelete={(t) => void handleDeleteTransaction(t)}
              />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <TransactionRulesPanel
              accounts={accounts}
              categories={categories}
              rules={transactionRules}
              isSubmitting={isSubmitting}
              onSaveRule={(rule) =>
                void (async () => {
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
                })()
              }
              onToggleRule={(rule) =>
                void (async () => {
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
                })()
              }
            />

            <RecurringObligationsPanel
              accounts={accounts}
              categories={categories}
              obligations={recurringObligations}
              evaluations={evaluateRecurringObligations(recurringObligations, transactions, closePeriod)}
              isSubmitting={isSubmitting}
              onSaveObligation={(obligation) =>
                void (async () => {
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
                })()
              }
              onToggleObligation={(obligation) =>
                void (async () => {
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
                })()
              }
            />
          </div>

          <MonthClosePanel
            period={closePeriod}
            monthClose={monthClose}
            evaluation={monthCloseEvaluation}
            recurringEvaluations={evaluateRecurringObligations(
              recurringObligations,
              transactions,
              closePeriod,
            )}
            isSubmitting={isSubmitting}
            onRefresh={() => {
              if (profile) {
                void refreshMonthCloseState(profile.id);
              }
            }}
            onClose={() =>
              void (async () => {
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
                  await loadWorkspace();
                } finally {
                  setIsSubmitting(false);
                }
              })()
            }
            onExport={() => {
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
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
