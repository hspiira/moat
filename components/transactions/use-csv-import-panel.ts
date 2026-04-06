"use client";

import { useMemo, useState } from "react";

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

import {
  buildImportPreviewRows,
  buildMessageHash,
  defaultCsvMappings,
  type CsvMappings,
} from "./csv-import-utils";
import { categoryMatchesType } from "./transaction-form";

const repositories = createIndexedDbRepositories();

function guessHeader(headers: string[], matcher: (normalizedHeader: string) => boolean) {
  return headers.find((header) => matcher(header.trim().toLowerCase())) ?? "";
}

type Params = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  profile: UserProfile;
  onImportSuccess: () => void;
  onError: (message: string) => void;
};

export function useCsvImportPanel({
  accounts,
  categories,
  transactions,
  profile,
  onImportSuccess,
  onError,
}: Params) {
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
      await Promise.all(
        nextTransactions.map((transaction) => repositories.transactions.upsert(transaction)),
      );

      clearCsv();
      onImportSuccess();
    } catch (importError) {
      onError(importError instanceof Error ? importError.message : "Unable to import CSV.");
    } finally {
      setIsImporting(false);
    }
  }

  return {
    csvHeaders,
    csvMappings,
    importName,
    defaultImportType,
    defaultImportAccountId,
    defaultImportCategoryId,
    defaultImportCurrency,
    defaultImportFxRate,
    isImporting,
    importCategories,
    validImportCount,
    duplicateCount,
    foreignCurrencyCount,
    previewRows,
    setCsvMappings,
    setDefaultImportType,
    setDefaultImportAccountId,
    setDefaultImportCategoryId,
    setDefaultImportCurrency,
    setDefaultImportFxRate,
    handleCsvFileChange,
    handleImportConfirm,
    clearCsv,
  };
}
