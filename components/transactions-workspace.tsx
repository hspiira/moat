"use client";

import { startTransition, useEffect, useState } from "react";

import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, Category, Transaction, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

import {
  TransactionForm,
  type TransactionFormState,
  categoryMatchesType,
  defaultTransactionForm,
} from "./transactions/transaction-form";
import { CsvImportPanel } from "./transactions/csv-import-panel";
import { TransactionList } from "./transactions/transaction-list";

const repositories = createIndexedDbRepositories();

/**
 * Sorts transactions by occurrence date and creation time in descending order.
 *
 * @param transactions - The array of transactions to sort
 * @returns A new array containing the same transactions sorted by `occurredOn` (newest first); when `occurredOn` is equal, by `createdAt` (newest first)
 */
function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => {
    if (a.occurredOn === b.occurredOn) return b.createdAt.localeCompare(a.createdAt);
    return b.occurredOn.localeCompare(a.occurredOn);
  });
}

/**
 * Render the Transactions workspace and manage loading, reconciliation, creation, editing, and deletion of a user's transactions.
 *
 * Manages local UI state, interacts with IndexedDB repositories to load and persist accounts, categories, and transactions, reconciles account balances, and delegates form, CSV import, and list rendering to child components.
 *
 * @returns The React element for the Transactions workspace view.
 */
export function TransactionsWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionForm, setTransactionForm] =
    useState<TransactionFormState>(defaultTransactionForm);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await repositories.userProfile.get();
      setProfile(nextProfile);

      if (!nextProfile) {
        setAccounts([]);
        setCategories([]);
        setTransactions([]);
        return;
      }

      const [storedAccounts, storedCategories, storedTransactions] = await Promise.all([
        repositories.accounts.listByUser(nextProfile.id),
        repositories.categories.listByUser(nextProfile.id),
        repositories.transactions.listByUser(nextProfile.id),
      ]);

      const reconciledAccounts = reconcileAccountBalances(storedAccounts, storedTransactions);
      await Promise.all(reconciledAccounts.map((a) => repositories.accounts.upsert(a)));

      setAccounts(reconciledAccounts);
      setCategories(storedCategories);
      setTransactions(sortTransactions(storedTransactions));

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
  }

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, []);

  async function refreshAccounts(userId: string) {
    const storedAccounts = await repositories.accounts.listByUser(userId);
    const storedTransactions = await repositories.transactions.listByUser(userId);
    const reconciled = reconcileAccountBalances(storedAccounts, storedTransactions);
    await Promise.all(reconciled.map((a) => repositories.accounts.upsert(a)));
  }

  async function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const amount = Number(transactionForm.amount);

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
            note: transactionForm.note.trim() || undefined,
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
            note: transactionForm.note.trim() || undefined,
            transferGroupId,
            createdAt: transactions.find((t) => t.id === destId)?.createdAt ?? timestamp,
            updatedAt: timestamp,
          }),
        ]);
      } else {
        const transactionId = editingTransactionId ?? `transaction:${crypto.randomUUID()}`;
        await repositories.transactions.upsert({
          id: transactionId,
          userId: profile.id,
          accountId: transactionForm.accountId,
          type: transactionForm.type,
          amount: Math.abs(amount),
          occurredOn: transactionForm.occurredOn,
          categoryId: transactionForm.categoryId,
          note: transactionForm.note.trim() || undefined,
          createdAt: transactions.find((t) => t.id === transactionId)?.createdAt ?? timestamp,
          updatedAt: timestamp,
        });
      }

      await refreshAccounts(profile.id);
      setEditingTransactionId(null);
      setTransactionForm({
        ...defaultTransactionForm,
        accountId: accounts[0]?.id ?? "",
        destinationAccountId: accounts[1]?.id ?? "",
        categoryId:
          categories.find((c) => categoryMatchesType(c, defaultTransactionForm.type))?.id ?? "",
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

      await refreshAccounts(profile.id);
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
            Record income, expenses, transfers, and savings contributions.
          </p>
        </div>
        {transactions.length > 0 ? (
          <div className="text-right text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{transactions.length}</div>
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
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <TransactionForm
            accounts={accounts}
            categories={categories}
            form={transactionForm}
            editingId={editingTransactionId}
            isSubmitting={isSubmitting}
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
      ) : null}
    </div>
  );
}
