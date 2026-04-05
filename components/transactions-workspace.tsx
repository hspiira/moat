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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const repositories = createIndexedDbRepositories();

type CsvFieldKey = "date" | "amount" | "note" | "type" | "category" | "account";
type CsvMappings = Record<CsvFieldKey, string>;

type TransactionFormState = {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  amount: string;
  occurredOn: string;
  note: string;
};

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

const transactionTypeLabels: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  savings_contribution: "Savings contribution",
  debt_payment: "Debt payment",
  transfer: "Transfer",
};

function categoryMatchesType(category: Category, type: TransactionType) {
  if (type === "income") return category.kind === "income";
  if (type === "transfer") return category.kind === "transfer";
  if (type === "savings_contribution") return category.kind === "savings";
  return category.kind === "expense";
}

function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => {
    if (a.occurredOn === b.occurredOn) return b.createdAt.localeCompare(a.createdAt);
    return b.occurredOn.localeCompare(a.occurredOn);
  });
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseImportedType(value: string): TransactionType | "" {
  const n = normalizeName(value);
  switch (n) {
    case "income": return "income";
    case "expense": return "expense";
    case "savings":
    case "savings contribution":
    case "savings_contribution": return "savings_contribution";
    case "debt":
    case "debt payment":
    case "debt_payment": return "debt_payment";
    case "transfer": return "transfer";
    default: return "";
  }
}

function detectDuplicate(
  preview: { accountId: string; occurredOn: string; amount: number; type: TransactionType | ""; note: string },
  existing: Transaction[],
) {
  return existing.some(
    (t) =>
      t.accountId === preview.accountId &&
      t.occurredOn === preview.occurredOn &&
      t.amount === preview.amount &&
      t.type === preview.type &&
      (t.note ?? "") === preview.note,
  );
}

export function TransactionsWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(defaultTransactionForm);
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
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load transactions.",
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
    () => categories.filter((c) => categoryMatchesType(c, transactionForm.type)),
    [categories, transactionForm.type],
  );

  const importCategories = useMemo(
    () => categories.filter((c) => categoryMatchesType(c, defaultImportType)),
    [categories, defaultImportType],
  );

  const importPreview = useMemo<ImportPreviewRow[]>(() => {
    if (!csvHeaders.length || !csvRows.length) return [];

    const accountLookup = new Map(accounts.map((a) => [normalizeName(a.name), a.id]));
    const categoryLookup = new Map(categories.map((c) => [normalizeName(c.name), c.id]));

    return csvRows.map((row, index) => {
      const getValue = (field: CsvFieldKey) => {
        const header = csvMappings[field];
        if (!header) return "";
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
        (accountName ? accountLookup.get(normalizeName(accountName)) : undefined) ?? defaultImportAccountId;
      const resolvedCategoryId =
        (categoryName ? categoryLookup.get(normalizeName(categoryName)) : undefined) ?? defaultImportCategoryId;
      const note = getValue("note");
      const issues: string[] = [];

      if (!occurredOn) issues.push("Missing date");
      if (!Number.isFinite(amountValue) || amountValue <= 0) issues.push("Invalid amount");
      if (!resolvedType) issues.push("Missing type");
      if (resolvedType === "transfer") issues.push("Transfer import not supported in CSV flow");
      if (!resolvedAccountId) issues.push("Unresolved account");
      if (!resolvedCategoryId) issues.push("Unresolved category");

      const duplicate = detectDuplicate(
        { accountId: resolvedAccountId, occurredOn, amount: Math.abs(amountValue), type: resolvedType, note },
        transactions,
      );
      if (duplicate) issues.push("Likely duplicate");

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
  }, [accounts, categories, csvHeaders, csvMappings, csvRows, defaultImportAccountId, defaultImportCategoryId, defaultImportType, transactions]);

  async function persistTransactions(next: Transaction[]) {
    await Promise.all(next.map((t) => repositories.transactions.upsert(t)));
  }

  async function refreshAccounts(userId: string) {
    const storedAccounts = await repositories.accounts.listByUser(userId);
    const storedTransactions = await repositories.transactions.listByUser(userId);
    const reconciled = reconcileAccountBalances(storedAccounts, storedTransactions);
    await Promise.all(reconciled.map((a) => repositories.accounts.upsert(a)));
  }

  async function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const source = await file.text();
      const parsed = parseCsvText(source);

      setImportName(file.name);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setCsvMappings({
        date: parsed.headers.find((h) => normalizeName(h).includes("date")) ?? "",
        amount:
          parsed.headers.find((h) => normalizeName(h).includes("amount")) ??
          parsed.headers.find((h) => normalizeName(h).includes("debit")) ??
          "",
        note:
          parsed.headers.find((h) => normalizeName(h).includes("note")) ??
          parsed.headers.find((h) => normalizeName(h).includes("description")) ??
          "",
        type: parsed.headers.find((h) => normalizeName(h).includes("type")) ?? "",
        category: parsed.headers.find((h) => normalizeName(h).includes("category")) ?? "",
        account: parsed.headers.find((h) => normalizeName(h).includes("account")) ?? "",
      });
      setDefaultImportAccountId(accounts[0]?.id ?? "");
      setDefaultImportCategoryId(
        categories.find((c) => categoryMatchesType(c, defaultImportType))?.id ?? "",
      );
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Unable to parse CSV file.");
    }
  }

  async function handleImportConfirm() {
    if (!profile) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const validRows = importPreview.filter(
        (row) => row.issues.length === 0 && row.type && row.accountId && row.categoryId,
      );

      if (validRows.length === 0) throw new Error("No valid rows to import.");

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
      await Promise.all(nextTransactions.map((t) => repositories.transactions.upsert(t)));
      await refreshAccounts(profile.id);

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
    if (!profile) return;

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
          throw new Error("Source and destination must be different accounts.");
        }

        const transferGroupId =
          editingTransactionId?.split(":")[0] ?? `transfer:${crypto.randomUUID()}`;
        const sourceId = `${transferGroupId}:source`;
        const destId = `${transferGroupId}:destination`;

        await persistTransactions([
          {
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
          },
          {
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
          },
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

  const validImportCount = importPreview.filter((r) => r.issues.length === 0).length;

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
          {/* Add / edit form */}
          <Card className="border-border/40 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                {editingTransactionId ? "Edit transaction" : "Add transaction"}
              </CardTitle>
              <CardDescription>
                {editingTransactionId
                  ? "Update this transaction."
                  : "Record a single money event against an account."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleTransactionSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="tx-type">Type</Label>
                  <Select
                    value={transactionForm.type}
                    onValueChange={(v) => {
                      const nextType = v as TransactionType;
                      setEditingTransactionId(null);
                      setTransactionForm((c) => ({
                        ...c,
                        type: nextType,
                        categoryId:
                          categories.find((cat) => categoryMatchesType(cat, nextType))?.id ?? "",
                      }));
                    }}
                  >
                    <SelectTrigger id="tx-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(transactionTypeLabels) as TransactionType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          {transactionTypeLabels[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tx-account">
                    {transactionForm.type === "transfer" ? "From account" : "Account"}
                  </Label>
                  <Select
                    value={transactionForm.accountId}
                    onValueChange={(v) =>
                      setTransactionForm((c) => ({ ...c, accountId: v }))
                    }
                  >
                    <SelectTrigger id="tx-account">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {transactionForm.type === "transfer" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="tx-dest">To account</Label>
                    <Select
                      value={transactionForm.destinationAccountId}
                      onValueChange={(v) =>
                        setTransactionForm((c) => ({ ...c, destinationAccountId: v }))
                      }
                    >
                      <SelectTrigger id="tx-dest">
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="tx-category">Category</Label>
                  <Select
                    value={transactionForm.categoryId}
                    onValueChange={(v) =>
                      setTransactionForm((c) => ({ ...c, categoryId: v }))
                    }
                  >
                    <SelectTrigger id="tx-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tx-amount">Amount (UGX)</Label>
                  <Input
                    id="tx-amount"
                    inputMode="decimal"
                    value={transactionForm.amount}
                    onChange={(e) =>
                      setTransactionForm((c) => ({ ...c, amount: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tx-date">Date</Label>
                  <Input
                    id="tx-date"
                    type="date"
                    value={transactionForm.occurredOn}
                    onChange={(e) =>
                      setTransactionForm((c) => ({ ...c, occurredOn: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="tx-note">Note</Label>
                  <Textarea
                    id="tx-note"
                    value={transactionForm.note}
                    onChange={(e) =>
                      setTransactionForm((c) => ({ ...c, note: e.target.value }))
                    }
                    placeholder="Optional"
                    className="min-h-16"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button disabled={isSubmitting} type="submit" size="sm">
                    {isSubmitting
                      ? "Saving..."
                      : editingTransactionId
                        ? "Update"
                        : "Add transaction"}
                  </Button>
                  {editingTransactionId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingTransactionId(null);
                        setTransactionForm(defaultTransactionForm);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="grid gap-5 content-start">
            {/* CSV import */}
            <Card className="border-border/40 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">CSV import</CardTitle>
                <CardDescription>
                  Upload a CSV statement, map columns, preview rows, then confirm.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Input
                  accept=".csv,text/csv"
                  type="file"
                  onChange={(e) => void handleCsvFileChange(e)}
                  className="cursor-pointer"
                />

                {csvHeaders.length > 0 ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
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
                        <div key={field} className="grid gap-1.5">
                          <Label className="text-xs">{label}</Label>
                          <Select
                            value={csvMappings[field] || "__none__"}
                            onValueChange={(v) =>
                              setCsvMappings((c) => ({
                                ...c,
                                [field]: v === "__none__" ? "" : v,
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Not mapped" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Not mapped</SelectItem>
                              {csvHeaders.map((header) => (
                                <SelectItem key={`${field}:${header}`} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Default type</Label>
                        <Select
                          value={defaultImportType}
                          onValueChange={(v) => {
                            const nextType = v as Exclude<TransactionType, "transfer">;
                            setDefaultImportType(nextType);
                            setDefaultImportCategoryId(
                              categories.find((c) => categoryMatchesType(c, nextType))?.id ?? "",
                            );
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="savings_contribution">Savings</SelectItem>
                            <SelectItem value="debt_payment">Debt payment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-xs">Default account</Label>
                        <Select
                          value={defaultImportAccountId || "__none__"}
                          onValueChange={(v) =>
                            setDefaultImportAccountId(v === "__none__" ? "" : v)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {accounts.map((a) => (
                              <SelectItem key={`import-acct:${a.id}`} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="text-xs">Default category</Label>
                        <Select
                          value={defaultImportCategoryId || "__none__"}
                          onValueChange={(v) =>
                            setDefaultImportCategoryId(v === "__none__" ? "" : v)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {importCategories.map((c) => (
                              <SelectItem key={`import-cat:${c.id}`} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {importName} · {validImportCount} valid row
                      {validImportCount !== 1 ? "s" : ""} ·{" "}
                      {importPreview.filter((r) => r.duplicate).length} likely duplicates
                    </p>

                    <div className="grid gap-2">
                      {importPreview.slice(0, 6).map((row) => {
                        const account = accounts.find((a) => a.id === row.accountId);
                        const category = categories.find((c) => c.id === row.categoryId);

                        return (
                          <div
                            key={row.id}
                            className={[
                              "rounded-md border px-3 py-2.5 text-sm",
                              row.issues.length > 0
                                ? "border-destructive/30 bg-destructive/5"
                                : "border-border/40 bg-muted/30",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                Row {row.rowIndex}
                              </span>
                              <span className="font-medium tabular-nums">
                                {Number.isFinite(row.amount)
                                  ? formatCurrency(row.amount)
                                  : "—"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {row.occurredOn || "no date"}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {account?.name ?? "—"} · {category?.name ?? "—"}
                            </div>
                            {row.issues.length > 0 ? (
                              <div className="mt-1 text-xs text-destructive">
                                {row.issues.join(" · ")}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={isSubmitting || validImportCount === 0}
                        onClick={() => void handleImportConfirm()}
                      >
                        {isSubmitting ? "Importing..." : `Import ${validImportCount} rows`}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCsvHeaders([]);
                          setCsvRows([]);
                          setCsvMappings(defaultCsvMappings);
                          setImportName("");
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            {/* Transaction list */}
            <Card className="border-border/40 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Recorded transactions</CardTitle>
                <CardDescription>
                  Transfer pairs are shown as individual records. Non-transfer entries can be edited.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {transactions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
                    No transactions yet.
                  </div>
                ) : (
                  transactions.map((transaction) => {
                    const account = accounts.find((a) => a.id === transaction.accountId);
                    const category = categories.find((c) => c.id === transaction.categoryId);
                    const isTransfer = transaction.type === "transfer";

                    return (
                      <div
                        key={transaction.id}
                        className="rounded-md border border-border/40 bg-muted/30 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium tabular-nums text-foreground">
                                {formatCurrency(Math.abs(transaction.amount))}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {transactionTypeLabels[transaction.type]}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {transaction.occurredOn} · {account?.name ?? "—"} ·{" "}
                              {category?.name ?? "—"}
                            </div>
                            {transaction.note ? (
                              <div className="text-xs text-muted-foreground">
                                {transaction.note}
                              </div>
                            ) : null}
                          </div>
                          {!isTransfer ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => beginTransactionEdit(transaction)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                onClick={() => void handleDeleteTransaction(transaction)}
                              >
                                Delete
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteTransaction(transaction)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
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
