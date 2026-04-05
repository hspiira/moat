"use client";

import { useMemo, useState } from "react";

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

import { categoryMatchesType } from "./transaction-form";

const repositories = createIndexedDbRepositories();

type CsvFieldKey = "date" | "amount" | "note" | "type" | "category" | "account";
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

const defaultCsvMappings: CsvMappings = {
  date: "",
  amount: "",
  note: "",
  type: "",
  category: "",
  account: "",
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseImportedType(value: string): TransactionType | "" {
  const n = normalizeName(value);
  switch (n) {
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  profile: UserProfile;
  onImportSuccess: () => void;
  onError: (message: string) => void;
};

export function CsvImportPanel({
  accounts,
  categories,
  transactions,
  profile,
  onImportSuccess,
  onError,
}: Props) {
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvMappings, setCsvMappings] = useState<CsvMappings>(defaultCsvMappings);
  const [importName, setImportName] = useState("");
  const [defaultImportType, setDefaultImportType] =
    useState<Exclude<TransactionType, "transfer">>("expense");
  const [defaultImportAccountId, setDefaultImportAccountId] = useState("");
  const [defaultImportCategoryId, setDefaultImportCategoryId] = useState("");
  const [isImporting, setIsImporting] = useState(false);

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
        return headerIndex >= 0 ? (row[headerIndex] ?? "") : "";
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

      if (!occurredOn) issues.push("Missing date");
      if (!Number.isFinite(amountValue) || amountValue <= 0) issues.push("Invalid amount");
      if (!resolvedType) issues.push("Missing type");
      if (resolvedType === "transfer") issues.push("Transfer import not supported in CSV flow");
      if (!resolvedAccountId) issues.push("Unresolved account");
      if (!resolvedCategoryId) issues.push("Unresolved category");

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

  function clearCsv() {
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvMappings(defaultCsvMappings);
    setImportName("");
  }

  async function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

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
      onError(fileError instanceof Error ? fileError.message : "Unable to parse CSV file.");
    }
  }

  async function handleImportConfirm() {
    setIsImporting(true);

    try {
      const validRows = importPreview.filter(
        (row) => row.issues.length === 0 && row.type && row.accountId && row.categoryId,
      );

      if (validRows.length === 0) throw new Error("No valid rows to import.");

      const now = new Date().toISOString();
      const importBatch: ImportBatch = {
        id: `import:${crypto.randomUUID()}`,
        userId: profile.id,
        sourceName: importName || "CSV import",
        importedAt: now,
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
        createdAt: now,
        updatedAt: now,
      }));

      await repositories.imports.upsert(importBatch);
      await Promise.all(nextTransactions.map((t) => repositories.transactions.upsert(t)));

      clearCsv();
      onImportSuccess();
    } catch (importError) {
      onError(importError instanceof Error ? importError.message : "Unable to import CSV.");
    } finally {
      setIsImporting(false);
    }
  }

  const validImportCount = importPreview.filter((r) => r.issues.length === 0).length;
  const duplicateCount = importPreview.filter((r) => r.duplicate).length;
  const previewRows = importPreview.slice(0, 6);

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <CardHeader className="moat-panel-lilac min-h-20 gap-1 border-b border-border/20 py-3 text-foreground">
        <CardTitle className="text-lg text-foreground">CSV import</CardTitle>
        <CardDescription className="text-foreground/72 leading-6">
          Upload, map, review, then confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 pt-6">
        <Input
          accept=".csv,text/csv"
          type="file"
          onChange={(e) => void handleCsvFileChange(e)}
          className="cursor-pointer"
        />

        {csvHeaders.length > 0 ? (
          <>
            <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-border/20 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">1. Map columns</CardTitle>
                  <CardDescription>Match your CSV headings to Moat fields.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
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
                        <SelectTrigger className="h-9 text-xs">
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
                </CardContent>
              </Card>

              <Card className="moat-panel-yellow border-border/20 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-foreground">2. Fill gaps</CardTitle>
                  <CardDescription className="text-foreground/72">
                    Set defaults for rows that do not carry enough information.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
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
                      <SelectTrigger className="h-9 text-xs">
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
                      onValueChange={(v) => setDefaultImportAccountId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
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
                      onValueChange={(v) => setDefaultImportCategoryId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
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
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <Card className="moat-panel-mint border-border/20 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-foreground">3. Review import</CardTitle>
                  <CardDescription className="text-foreground/72">
                    {importName} · {validImportCount} valid row
                    {validImportCount !== 1 ? "s" : ""} · {duplicateCount} likely duplicates
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-border/20 bg-background/60 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Valid rows
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {validImportCount}
                      </div>
                    </div>
                    <div className="border border-border/20 bg-background/60 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Duplicates
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {duplicateCount}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={isImporting || validImportCount === 0}
                      onClick={() => void handleImportConfirm()}
                    >
                      {isImporting ? "Importing..." : `Import ${validImportCount} rows`}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearCsv}>
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/20 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Preview</CardTitle>
                  <CardDescription>First six rows after mapping and fallback rules.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {previewRows.map((row, index) => {
                    const account = accounts.find((a) => a.id === row.accountId);
                    const category = categories.find((c) => c.id === row.categoryId);

                    return (
                      <div
                        key={row.id}
                        className={`border px-3 py-3 text-sm ${
                          row.issues.length > 0
                            ? "border-destructive/30 bg-destructive/5"
                            : index === 0
                              ? "moat-panel-sage border-border/20"
                              : index % 2 === 0
                                ? "moat-panel-mint border-border/20"
                                : "bg-muted/20 border-border/20"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Row {row.rowIndex}
                          </span>
                          <span className="text-base font-semibold tabular-nums">
                            {Number.isFinite(row.amount) ? formatCurrency(row.amount) : "—"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.occurredOn || "no date"} · {account?.name ?? "—"} ·{" "}
                          {category?.name ?? "—"}
                        </div>
                        {row.issues.length > 0 ? (
                          <div className="mt-1.5 text-xs text-destructive">
                            {row.issues.join(" · ")}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
