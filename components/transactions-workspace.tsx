"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { parseCsvText } from "@/lib/import/csv";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type {
  Account,
  Category,
  ImportBatch,
  Transaction,
  TransactionType,
  UserProfile,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const repositories = createIndexedDbRepositories();

type CsvFieldKey =
  | "date"
  | "amount"
  | "note"
  | "type"
  | "category"
  | "account";

type TransactionFormState = {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  amount: string;
  occurredOn: string;
  note: string;
};

type CsvMappings = Record<CsvFieldKey, string>;

type ImportPreviewRow = {
  id: string;
  rowIndex: number;
  occurredOn: string;
  amount: number;
  type: TransactionType | "";
  accountId: string;
  categoryId: string;
  note: string;
  duplicate: boolean;
  issues: string[];
};

const defaultTransactionForm: TransactionFormState = {
  type: "expense",
  accountId: "",
  destinationAccountId: "",
  categoryId: "",
  amount: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  note: "",
};

const defaultCsvMappings: CsvMappings = {
  date: "",
  amount: "",
  note: "",
  type: "",
  category: "",
  account: "",
};

function buildTimestamp() {
  return new Date().toISOString();
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function transactionTypeLabel(type: TransactionType) {
  return type.replaceAll("_", " ");
}

function categoryMatchesType(category: Category, type: TransactionType) {
  if (type === "income") {
    return category.kind === "income";
  }

  if (type === "transfer") {
    return category.kind === "transfer";
  }

  if (type === "savings_contribution") {
    return category.kind === "savings";
  }

  return category.kind === "expense";
}

function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((left, right) => {
    if (left.occurredOn === right.occurredOn) {
      return right.createdAt.localeCompare(left.createdAt);
    }

    return right.occurredOn.localeCompare(left.occurredOn);
  });
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseImportedType(value: string): TransactionType | "" {
  const normalized = normalizeName(value);

  switch (normalized) {
    case "income":
      return "income";
    case "expense":
      return "expense";
    case "savings":
    case "savings contribution":
    case "savings_contribution":
      return "savings_contribution";
    case "debt":
    case "debt payment":
    case "debt_payment":
      return "debt_payment";
    case "transfer":
      return "transfer";
    default:
      return "";
  }
}

function detectDuplicate(
  preview: {
    accountId: string;
    occurredOn: string;
    amount: number;
    type: TransactionType | "";
    note: string;
  },
  existingTransactions: Transaction[],
) {
  return existingTransactions.some(
    (transaction) =>
      transaction.accountId === preview.accountId &&
      transaction.occurredOn === preview.occurredOn &&
      transaction.amount === preview.amount &&
      transaction.type === preview.type &&
      (transaction.note ?? "") === preview.note,
  );
}

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
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMappings, setCsvMappings] = useState<CsvMappings>(defaultCsvMappings);
  const [importName, setImportName] = useState("");
  const [defaultImportType, setDefaultImportType] =
    useState<Exclude<TransactionType, "transfer">>("expense");
  const [defaultImportAccountId, setDefaultImportAccountId] = useState("");
  const [defaultImportCategoryId, setDefaultImportCategoryId] = useState("");

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

      await Promise.all(
        reconciledAccounts.map((account) => repositories.accounts.upsert(account)),
      );

      setAccounts(reconciledAccounts);
      setCategories(storedCategories);
      setTransactions(sortTransactions(storedTransactions));

      setTransactionForm((current) => ({
        ...current,
        accountId: current.accountId || reconciledAccounts[0]?.id || "",
        destinationAccountId:
          current.destinationAccountId || reconciledAccounts[1]?.id || "",
        categoryId:
          current.categoryId ||
          storedCategories.find((category) =>
            categoryMatchesType(category, current.type),
          )?.id ||
          "",
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load transaction workspace.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, []);

  const availableCategories = useMemo(
    () =>
      categories.filter((category) => categoryMatchesType(category, transactionForm.type)),
    [categories, transactionForm.type],
  );

  const importCategories = useMemo(
    () =>
      categories.filter((category) => categoryMatchesType(category, defaultImportType)),
    [categories, defaultImportType],
  );

  const importPreview = useMemo<ImportPreviewRow[]>(() => {
    if (!csvHeaders.length || !csvRows.length) {
      return [];
    }

    const accountLookup = new Map(accounts.map((account) => [normalizeName(account.name), account.id]));
    const categoryLookup = new Map(
      categories.map((category) => [normalizeName(category.name), category.id]),
    );

    return csvRows.map((row, index) => {
      const getValue = (field: CsvFieldKey) => {
        const header = csvMappings[field];
        if (!header) {
          return "";
        }

        const headerIndex = csvHeaders.indexOf(header);
        return headerIndex >= 0 ? row[headerIndex] ?? "" : "";
      };

      const occurredOn = getValue("date");
      const amountValue = Number(getValue("amount"));
      const importedType = parseImportedType(getValue("type"));
      const resolvedType = importedType || defaultImportType;
      const accountName = getValue("account");
      const categoryName = getValue("category");
      const resolvedAccountId =
        (accountName ? accountLookup.get(normalizeName(accountName)) : undefined) ??
        defaultImportAccountId;
      const resolvedCategoryId =
        (categoryName ? categoryLookup.get(normalizeName(categoryName)) : undefined) ??
        defaultImportCategoryId;
      const note = getValue("note");
      const issues: string[] = [];

      if (!occurredOn) {
        issues.push("Missing date");
      }

      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        issues.push("Invalid amount");
      }

      if (!resolvedType) {
        issues.push("Missing transaction type");
      }

      if (resolvedType === "transfer") {
        issues.push("Transfer import is not supported in the CSV flow");
      }

      if (!resolvedAccountId) {
        issues.push("Unresolved account");
      }

      if (!resolvedCategoryId) {
        issues.push("Unresolved category");
      }

      const duplicate = detectDuplicate(
        {
          accountId: resolvedAccountId,
          occurredOn,
          amount: Math.abs(amountValue),
          type: resolvedType,
          note,
        },
        transactions,
      );

      if (duplicate) {
        issues.push("Likely duplicate");
      }

      return {
        id: `preview:${index}`,
        rowIndex: index + 1,
        occurredOn,
        amount: Math.abs(amountValue),
        type: resolvedType,
        accountId: resolvedAccountId,
        categoryId: resolvedCategoryId,
        note,
        duplicate,
        issues,
      };
    });
  }, [
    accounts,
    categories,
    csvHeaders,
    csvMappings,
    csvRows,
    defaultImportAccountId,
    defaultImportCategoryId,
    defaultImportType,
    transactions,
  ]);

  async function persistTransactions(nextTransactions: Transaction[]) {
    await Promise.all(
      nextTransactions.map((transaction) => repositories.transactions.upsert(transaction)),
    );
  }

  async function refreshAccountsFromTransactions(userId: string) {
    const storedAccounts = await repositories.accounts.listByUser(userId);
    const storedTransactions = await repositories.transactions.listByUser(userId);
    const reconciledAccounts = reconcileAccountBalances(storedAccounts, storedTransactions);

    await Promise.all(
      reconciledAccounts.map((account) => repositories.accounts.upsert(account)),
    );
  }

  async function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);

    try {
      const source = await file.text();
      const parsed = parseCsvText(source);

      setImportName(file.name);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setCsvMappings({
        date: parsed.headers.find((header) => normalizeName(header).includes("date")) ?? "",
        amount:
          parsed.headers.find((header) => normalizeName(header).includes("amount")) ??
          parsed.headers.find((header) => normalizeName(header).includes("debit")) ??
          "",
        note:
          parsed.headers.find((header) => normalizeName(header).includes("note")) ??
          parsed.headers.find((header) => normalizeName(header).includes("description")) ??
          "",
        type: parsed.headers.find((header) => normalizeName(header).includes("type")) ?? "",
        category:
          parsed.headers.find((header) => normalizeName(header).includes("category")) ?? "",
        account:
          parsed.headers.find((header) => normalizeName(header).includes("account")) ?? "",
      });
      setDefaultImportAccountId(accounts[0]?.id ?? "");
      setDefaultImportCategoryId(
        categories.find((category) => categoryMatchesType(category, defaultImportType))?.id ?? "",
      );
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Unable to parse CSV file.");
    }
  }

  async function handleImportConfirm() {
    if (!profile) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const validRows = importPreview.filter(
        (row) => row.issues.length === 0 && row.type && row.accountId && row.categoryId,
      );

      if (validRows.length === 0) {
        throw new Error("No valid rows are available to import.");
      }

      const importBatch: ImportBatch = {
        id: `import:${crypto.randomUUID()}`,
        userId: profile.id,
        sourceName: importName || "CSV import",
        importedAt: buildTimestamp(),
        rowCount: validRows.length,
      };

      const nextTransactions: Transaction[] = validRows.map((row) => ({
        id: `transaction:${crypto.randomUUID()}`,
        userId: profile.id,
        accountId: row.accountId,
        type: row.type as Exclude<TransactionType, "transfer">,
        amount: row.amount,
        occurredOn: row.occurredOn,
        categoryId: row.categoryId,
        note: row.note || undefined,
        importBatchId: importBatch.id,
        createdAt: importBatch.importedAt,
        updatedAt: importBatch.importedAt,
      }));

      await repositories.imports.upsert(importBatch);
      await Promise.all(
        nextTransactions.map((transaction) => repositories.transactions.upsert(transaction)),
      );

      await refreshAccountsFromTransactions(profile.id);
      setCsvHeaders([]);
      setCsvRows([]);
      setCsvMappings(defaultCsvMappings);
      setImportName("");
      await loadWorkspace();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Unable to import CSV.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = buildTimestamp();
      const amount = Number(transactionForm.amount);

      if (transactionForm.type === "transfer") {
        if (!transactionForm.accountId || !transactionForm.destinationAccountId) {
          throw new Error("Transfer requires a source and destination account.");
        }

        if (transactionForm.accountId === transactionForm.destinationAccountId) {
          throw new Error("Transfer source and destination must be different accounts.");
        }

        const transferGroupId =
          editingTransactionId?.split(":")[0] ?? `transfer:${crypto.randomUUID()}`;
        const sourceId = `${transferGroupId}:source`;
        const destinationId = `${transferGroupId}:destination`;

        const sourceTransaction: Transaction = {
          id: sourceId,
          userId: profile.id,
          accountId: transactionForm.accountId,
          type: "transfer",
          amount: -Math.abs(amount),
          occurredOn: transactionForm.occurredOn,
          categoryId: transactionForm.categoryId,
          note: transactionForm.note.trim() || undefined,
          transferGroupId,
          createdAt:
            transactions.find((transaction) => transaction.id === sourceId)?.createdAt ??
            timestamp,
          updatedAt: timestamp,
        };

        const destinationTransaction: Transaction = {
          id: destinationId,
          userId: profile.id,
          accountId: transactionForm.destinationAccountId,
          type: "transfer",
          amount: Math.abs(amount),
          occurredOn: transactionForm.occurredOn,
          categoryId: transactionForm.categoryId,
          note: transactionForm.note.trim() || undefined,
          transferGroupId,
          createdAt:
            transactions.find((transaction) => transaction.id === destinationId)?.createdAt ??
            timestamp,
          updatedAt: timestamp,
        };

        await persistTransactions([sourceTransaction, destinationTransaction]);
      } else {
        const transactionId = editingTransactionId ?? `transaction:${crypto.randomUUID()}`;
        const nextTransaction: Transaction = {
          id: transactionId,
          userId: profile.id,
          accountId: transactionForm.accountId,
          type: transactionForm.type,
          amount: Math.abs(amount),
          occurredOn: transactionForm.occurredOn,
          categoryId: transactionForm.categoryId,
          note: transactionForm.note.trim() || undefined,
          createdAt:
            transactions.find((transaction) => transaction.id === transactionId)?.createdAt ??
            timestamp,
          updatedAt: timestamp,
        };

        await repositories.transactions.upsert(nextTransaction);
      }

      await refreshAccountsFromTransactions(profile.id);
      setEditingTransactionId(null);
      setTransactionForm({
        ...defaultTransactionForm,
        accountId: accounts[0]?.id ?? "",
        destinationAccountId: accounts[1]?.id ?? "",
        categoryId:
          categories.find((category) => categoryMatchesType(category, defaultTransactionForm.type))
            ?.id ?? "",
      });
      await loadWorkspace();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save transaction.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginTransactionEdit(transaction: Transaction) {
    if (transaction.type === "transfer") {
      return;
    }

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
    if (!profile) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (transaction.transferGroupId) {
        const linkedTransactions = transactions.filter(
          (candidate) => candidate.transferGroupId === transaction.transferGroupId,
        );

        await Promise.all(
          linkedTransactions.map((candidate) => repositories.transactions.remove(candidate.id)),
        );
      } else {
        await repositories.transactions.remove(transaction.id);
      }

      if (editingTransactionId === transaction.id) {
        setEditingTransactionId(null);
        setTransactionForm(defaultTransactionForm);
      }

      await refreshAccountsFromTransactions(profile.id);
      await loadWorkspace();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete transaction.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasSetup = Boolean(profile);
  const transactionCount = transactions.length;
  const transferCount = transactions.filter((transaction) => transaction.type === "transfer").length;
  const validImportCount = importPreview.filter((row) => row.issues.length === 0).length;

  return (
    <div className="grid gap-6">
      <Card className="border-border/70 bg-background/95 shadow-lg shadow-primary/5">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.85fr] lg:p-8">
          <div className="space-y-4">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              Issue #5
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Transactions and transfer-safe money movement
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                This route now records persisted money events against real accounts
                and categories. Transfers are stored as paired records so account
                balances stay coherent without inflating spend.
              </p>
            </div>
          </div>

          <Card className="border-border/70 bg-muted/35 shadow-none">
            <CardHeader>
              <Badge variant="outline" className="w-fit bg-background/70">
                Current scope
              </Badge>
              <CardTitle>What this route implements</CardTitle>
              <CardDescription className="leading-7">
                Manual entry, editing for non-transfer records, transfer-pair
                creation, deletion, CSV normalization/preview, and account balance
                reconciliation from saved transaction history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div>Saved transactions: {transactionCount}</div>
              <div>Transfer records: {transferCount}</div>
              <div>Accounts available: {accounts.length}</div>
              <div>Import-ready rows: {validImportCount}</div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-6 py-5 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {!hasSetup && !isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="px-6 py-8 text-sm leading-7 text-muted-foreground">
            Complete onboarding and add at least one account on the Accounts route
            before creating transactions.
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            Loading transaction workspace...
          </CardContent>
        </Card>
      ) : null}

      {hasSetup && !isLoading ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle>
                {editingTransactionId ? "Edit transaction" : "Add transaction"}
              </CardTitle>
              <CardDescription className="leading-7">
                This form persists through the transaction repository and then
                recalculates balances for all accounts from transaction history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleTransactionSubmit}>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Transaction type</span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={transactionForm.type}
                    onChange={(event) => {
                      const nextType = event.target.value as TransactionType;
                      setEditingTransactionId(null);
                      setTransactionForm((current) => ({
                        ...current,
                        type: nextType,
                        categoryId:
                          categories.find((category) => categoryMatchesType(category, nextType))
                            ?.id ?? "",
                      }));
                    }}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="savings_contribution">Savings contribution</option>
                    <option value="debt_payment">Debt payment</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">
                    {transactionForm.type === "transfer" ? "Source account" : "Account"}
                  </span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={transactionForm.accountId}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        accountId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="" disabled>
                      Select account
                    </option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.type.replaceAll("_", " ")})
                      </option>
                    ))}
                  </select>
                </label>

                {transactionForm.type === "transfer" ? (
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Destination account</span>
                    <select
                      className="rounded-lg border border-border bg-background px-3 py-2"
                      value={transactionForm.destinationAccountId}
                      onChange={(event) =>
                        setTransactionForm((current) => ({
                          ...current,
                          destinationAccountId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="" disabled>
                        Select destination
                      </option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.type.replaceAll("_", " ")})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Category</span>
                  <select
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    value={transactionForm.categoryId}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Amount</span>
                  <input
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    inputMode="decimal"
                    value={transactionForm.amount}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Date</span>
                  <input
                    className="rounded-lg border border-border bg-background px-3 py-2"
                    type="date"
                    value={transactionForm.occurredOn}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        occurredOn: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Note</span>
                  <textarea
                    className="min-h-24 rounded-lg border border-border bg-background px-3 py-2"
                    value={transactionForm.note}
                    onChange={(event) =>
                      setTransactionForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting
                      ? "Saving..."
                      : editingTransactionId
                        ? "Update transaction"
                        : "Create transaction"}
                  </Button>
                  {editingTransactionId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingTransactionId(null);
                        setTransactionForm(defaultTransactionForm);
                      }}
                    >
                      Cancel edit
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>CSV import</CardTitle>
                <CardDescription className="leading-7">
                  Parse a CSV, map columns, preview normalized rows, and only import
                  rows that resolve cleanly against the saved accounts and categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <input
                  accept=".csv,text/csv"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  type="file"
                  onChange={(event) => void handleCsvFileChange(event)}
                />

                {csvHeaders.length > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(
                        [
                          ["date", "Date column"],
                          ["amount", "Amount column"],
                          ["note", "Note column"],
                          ["type", "Type column"],
                          ["category", "Category column"],
                          ["account", "Account column"],
                        ] as [CsvFieldKey, string][]
                      ).map(([field, label]) => (
                        <label className="grid gap-2 text-sm" key={field}>
                          <span className="font-medium">{label}</span>
                          <select
                            className="rounded-lg border border-border bg-background px-3 py-2"
                            value={csvMappings[field]}
                            onChange={(event) =>
                              setCsvMappings((current) => ({
                                ...current,
                                [field]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Not mapped</option>
                            {csvHeaders.map((header) => (
                              <option key={`${field}:${header}`} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Default type</span>
                        <select
                          className="rounded-lg border border-border bg-background px-3 py-2"
                          value={defaultImportType}
                          onChange={(event) => {
                            const nextType = event.target
                              .value as Exclude<TransactionType, "transfer">;
                            setDefaultImportType(nextType);
                            setDefaultImportCategoryId(
                              categories.find((category) =>
                                categoryMatchesType(category, nextType),
                              )?.id ?? "",
                            );
                          }}
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="savings_contribution">Savings contribution</option>
                          <option value="debt_payment">Debt payment</option>
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Default account</span>
                        <select
                          className="rounded-lg border border-border bg-background px-3 py-2"
                          value={defaultImportAccountId}
                          onChange={(event) => setDefaultImportAccountId(event.target.value)}
                        >
                          <option value="">None</option>
                          {accounts.map((account) => (
                            <option key={`import-account:${account.id}`} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Default category</span>
                        <select
                          className="rounded-lg border border-border bg-background px-3 py-2"
                          value={defaultImportCategoryId}
                          onChange={(event) => setDefaultImportCategoryId(event.target.value)}
                        >
                          <option value="">None</option>
                          {importCategories.map((category) => (
                            <option key={`import-category:${category.id}`} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
                      Import source: {importName} • {validImportCount} valid rows •{" "}
                      {importPreview.filter((row) => row.duplicate).length} likely duplicates
                    </div>

                    <div className="grid gap-3">
                      {importPreview.slice(0, 8).map((row) => {
                        const account = accounts.find((candidate) => candidate.id === row.accountId);
                        const category = categories.find(
                          (candidate) => candidate.id === row.categoryId,
                        );

                        return (
                          <Card
                            key={row.id}
                            className="border-border/70 bg-muted/35 shadow-none"
                          >
                            <CardHeader className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Row {row.rowIndex}</Badge>
                                <Badge variant="outline">
                                  {row.type ? transactionTypeLabel(row.type) : "unresolved"}
                                </Badge>
                                <span className="text-sm font-medium text-foreground">
                                  {Number.isFinite(row.amount)
                                    ? formatCurrency(row.amount)
                                    : "Invalid amount"}
                                </span>
                              </div>
                              <CardDescription className="leading-6">
                                {row.occurredOn || "Missing date"}
                                {account ? ` • ${account.name}` : ""}
                                {category ? ` • ${category.name}` : ""}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                              {row.issues.length === 0 ? (
                                "Ready to import."
                              ) : (
                                <ul className="space-y-1">
                                  {row.issues.map((issue) => (
                                    <li key={`${row.id}:${issue}`}>{issue}</li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button disabled={isSubmitting || validImportCount === 0} onClick={() => void handleImportConfirm()}>
                        {isSubmitting ? "Importing..." : "Confirm import"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCsvHeaders([]);
                          setCsvRows([]);
                          setCsvMappings(defaultCsvMappings);
                          setImportName("");
                        }}
                      >
                        Clear import
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>Recorded transactions</CardTitle>
                <CardDescription className="leading-7">
                  Transfer records are stored as paired source and destination
                  entries. Non-transfer records can be edited inline from this list.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {transactions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
                    No transactions recorded yet.
                  </div>
                ) : (
                  transactions.map((transaction) => {
                    const account = accounts.find((candidate) => candidate.id === transaction.accountId);
                    const category = categories.find(
                      (candidate) => candidate.id === transaction.categoryId,
                    );
                    const isTransfer = transaction.type === "transfer";

                    return (
                      <Card
                        key={transaction.id}
                        className="border-border/70 bg-muted/35 shadow-none"
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  {transactionTypeLabel(transaction.type)}
                                </Badge>
                                <span className="text-sm font-medium text-foreground">
                                  {formatCurrency(Math.abs(transaction.amount))}
                                </span>
                              </div>
                              <CardDescription className="leading-6">
                                {account?.name ?? "Unknown account"}
                                {category ? ` • ${category.name}` : ""}
                                {transaction.transferGroupId ? " • linked transfer" : ""}
                                {transaction.importBatchId ? " • imported" : ""}
                              </CardDescription>
                            </div>

                            <div className="flex gap-2">
                              {!isTransfer ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => beginTransactionEdit(transaction)}
                                >
                                  Edit
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleDeleteTransaction(transaction)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                          <div>
                            <div className="font-medium text-foreground">Date</div>
                            <div>{transaction.occurredOn}</div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Direction</div>
                            <div>
                              {transaction.amount < 0 ? "Out of account" : "Into account"}
                            </div>
                          </div>
                          {transaction.note ? (
                            <div className="sm:col-span-2">
                              <Separator className="mb-3" />
                              {transaction.note}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
