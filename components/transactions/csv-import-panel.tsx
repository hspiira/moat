"use client";

import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/currency";
import { applyTransactionRules } from "@/lib/domain/rules";
import { parseCsvText } from "@/lib/import/csv";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type {
  Account,
  Category,
  ImportBatch,
  SupportedCurrency,
  Transaction,
  TransactionType,
  UserProfile,
} from "@/lib/types";
import { AccentCardHeader } from "@/components/accent-card-header";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import {
  optionsFromRecord,
  supportedCurrencyOptionLabels,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  buildImportPreviewRows,
  buildMessageHash,
  defaultCsvMappings,
  type CsvFieldKey,
  type CsvMappings,
} from "./csv-import-utils";
import { categoryMatchesType } from "./transaction-form";

const repositories = createIndexedDbRepositories();

const csvFieldLabels: [CsvFieldKey, string][] = [
  ["date", "Date column"],
  ["amount", "Amount column"],
  ["currency", "Currency column"],
  ["fxRate", "FX rate column"],
  ["payee", "Payee column"],
  ["note", "Note column"],
  ["type", "Type column"],
  ["category", "Category column"],
  ["account", "Account column"],
];

const defaultTypeOptions = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "savings_contribution", label: "Savings" },
  { value: "debt_payment", label: "Debt payment" },
];

function guessHeader(headers: string[], matcher: (normalizedHeader: string) => boolean) {
  return headers.find((header) => matcher(header.trim().toLowerCase())) ?? "";
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
  const [defaultImportCurrency, setDefaultImportCurrency] = useState<SupportedCurrency>("UGX");
  const [defaultImportFxRate, setDefaultImportFxRate] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const importCategories = useMemo(
    () => categories.filter((category) => categoryMatchesType(category, defaultImportType)),
    [categories, defaultImportType],
  );

  const importPreview = useMemo(
    () =>
      buildImportPreviewRows({
        rows: csvRows,
        csvHeaders,
        csvMappings,
        accounts,
        categories,
        transactions,
        defaultImportType,
        defaultImportAccountId,
        defaultImportCategoryId,
        defaultImportCurrency,
        defaultImportFxRate,
      }),
    [
      accounts,
      categories,
      csvHeaders,
      csvMappings,
      csvRows,
      defaultImportAccountId,
      defaultImportCategoryId,
      defaultImportCurrency,
      defaultImportFxRate,
      defaultImportType,
      transactions,
    ],
  );

  const validImportCount = importPreview.filter((row) => row.issues.length === 0).length;
  const duplicateCount = importPreview.filter((row) => row.duplicate).length;
  const foreignCurrencyCount = importPreview.filter((row) => row.currency !== "UGX").length;
  const previewRows = importPreview.slice(0, 6);

  function clearCsv() {
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvMappings(defaultCsvMappings);
    setImportName("");
    setDefaultImportCurrency("UGX");
    setDefaultImportFxRate("");
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
        date: guessHeader(parsed.headers, (header) => header.includes("date")),
        amount:
          guessHeader(parsed.headers, (header) => header.includes("amount")) ||
          guessHeader(parsed.headers, (header) => header.includes("debit")),
        currency: guessHeader(parsed.headers, (header) => header.includes("currency")),
        fxRate:
          guessHeader(parsed.headers, (header) => header.includes("fx")) ||
          guessHeader(parsed.headers, (header) => header.includes("rate")),
        payee:
          guessHeader(parsed.headers, (header) => header.includes("payee")) ||
          guessHeader(parsed.headers, (header) => header.includes("merchant")) ||
          guessHeader(parsed.headers, (header) => header.includes("sender")),
        note:
          guessHeader(parsed.headers, (header) => header.includes("note")) ||
          guessHeader(parsed.headers, (header) => header.includes("description")),
        type: guessHeader(parsed.headers, (header) => header.includes("type")),
        category: guessHeader(parsed.headers, (header) => header.includes("category")),
        account: guessHeader(parsed.headers, (header) => header.includes("account")),
      });
      setDefaultImportAccountId(accounts[0]?.id ?? "");
      setDefaultImportCategoryId(
        categories.find((category) => categoryMatchesType(category, defaultImportType))?.id ?? "",
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
      const rules = await repositories.transactionRules.listByUser(profile.id);

      if (validRows.length === 0) throw new Error("No valid rows to import.");

      const now = new Date().toISOString();
      const importBatch: ImportBatch = {
        id: `import:${crypto.randomUUID()}`,
        userId: profile.id,
        sourceName: importName || "CSV import",
        importedAt: now,
        rowCount: validRows.length,
      };

      const nextTransactions: Transaction[] = validRows.map((row) => {
        const baseTransaction: Transaction = {
          id: `transaction:${crypto.randomUUID()}`,
          userId: profile.id,
          accountId: row.accountId,
          type: row.type as Exclude<TransactionType, "transfer">,
          amount: row.normalizedAmount,
          currency: row.currency,
          originalAmount: row.originalAmount,
          fxRateToUgx: row.currency === "UGX" ? undefined : row.fxRateToUgx,
          occurredOn: row.occurredOn,
          categoryId: row.categoryId,
          payee: row.payee || undefined,
          rawPayee: row.payee || undefined,
          note: row.note || undefined,
          source: "csv",
          reconciliationState: row.payee ? "reviewed" : "parsed",
          reviewedAt: row.payee ? now : undefined,
          importBatchId: importBatch.id,
          messageHash: buildMessageHash([
            row.accountId,
            row.occurredOn,
            String(row.originalAmount),
            row.currency,
            String(row.fxRateToUgx ?? ""),
            row.type,
            row.payee,
            row.note,
          ]),
          createdAt: now,
          updatedAt: now,
        };

        return (
          applyTransactionRules(baseTransaction, rules)?.proposedTransaction ?? baseTransaction
        );
      });

      await repositories.imports.upsert(importBatch);
      await Promise.all(nextTransactions.map((transaction) => repositories.transactions.upsert(transaction)));

      clearCsv();
      onImportSuccess();
    } catch (importError) {
      onError(importError instanceof Error ? importError.message : "Unable to import CSV.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="lilac"
        title="CSV import"
        description="Upload, map, review, then confirm."
      />
      <CardContent className="grid gap-4 p-5 pt-6">
        <Input
          accept=".csv,text/csv"
          type="file"
          onChange={(event) => void handleCsvFileChange(event)}
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
                  {csvFieldLabels.map(([field, label]) => (
                    <SelectField
                      key={field}
                      label={label}
                      value={csvMappings[field] || "__none__"}
                      options={[
                        { value: "__none__", label: "Not mapped" },
                        ...csvHeaders.map((header) => ({ value: header, label: header })),
                      ]}
                      onValueChange={(value) =>
                        setCsvMappings((current) => ({
                          ...current,
                          [field]: value === "__none__" ? "" : value,
                        }))
                      }
                      placeholder="Not mapped"
                    />
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
                  <SelectField
                    label="Default type"
                    value={defaultImportType}
                    options={defaultTypeOptions}
                    onValueChange={(value) => {
                      const nextType = value as Exclude<TransactionType, "transfer">;
                      setDefaultImportType(nextType);
                      setDefaultImportCategoryId(
                        categories.find((category) => categoryMatchesType(category, nextType))?.id ??
                          "",
                      );
                    }}
                  />

                  <SelectField
                    label="Default account"
                    value={defaultImportAccountId || "__none__"}
                    options={[
                      { value: "__none__", label: "None" },
                      ...accounts.map((account) => ({ value: account.id, label: account.name })),
                    ]}
                    onValueChange={(value) =>
                      setDefaultImportAccountId(value === "__none__" ? "" : value)
                    }
                    placeholder="None"
                  />

                  <SelectField
                    label="Default category"
                    value={defaultImportCategoryId || "__none__"}
                    options={[
                      { value: "__none__", label: "None" },
                      ...importCategories.map((category) => ({
                        value: category.id,
                        label: category.name,
                      })),
                    ]}
                    onValueChange={(value) =>
                      setDefaultImportCategoryId(value === "__none__" ? "" : value)
                    }
                    placeholder="None"
                  />

                  <SelectField
                    label="Default currency"
                    value={defaultImportCurrency}
                    options={optionsFromRecord(supportedCurrencyOptionLabels)}
                    onValueChange={(value) => setDefaultImportCurrency(value as SupportedCurrency)}
                  />

                  <InputField
                    id="csv-default-fx-rate"
                    label="Default FX rate to UGX"
                    inputMode="decimal"
                    value={defaultImportFxRate}
                    onChange={(event) => setDefaultImportFxRate(event.target.value)}
                    placeholder="Only for foreign-currency rows"
                    disabled={defaultImportCurrency === "UGX" && !csvMappings.fxRate}
                  />
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
                  <div className="grid grid-cols-3 gap-3">
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
                    <div className="border border-border/20 bg-background/60 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        FX rows
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {foreignCurrencyCount}
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
                  <CardDescription>
                    First six rows after mapping and fallback rules.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {previewRows.map((row, index) => {
                    const account = accounts.find((entry) => entry.id === row.accountId);
                    const category = categories.find((entry) => entry.id === row.categoryId);

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
                          <span className="text-sm tabular-nums text-foreground">
                            {formatMoney(row.originalAmount, row.currency)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.occurredOn || "no date"} · {account?.name ?? "—"} ·{" "}
                          {category?.name ?? "—"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.currency !== "UGX" && row.fxRateToUgx ? (
                            <>
                              FX {row.fxRateToUgx.toLocaleString("en-UG")} →{" "}
                              <span className="text-foreground">
                                {formatMoney(row.normalizedAmount, "UGX")}
                              </span>
                            </>
                          ) : (
                            <>Posts as {formatMoney(row.normalizedAmount, "UGX")}</>
                          )}
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
