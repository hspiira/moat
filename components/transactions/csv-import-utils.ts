"use client";

import { normalizeAmountToUgx } from "@/lib/currency";
import type {
  Account,
  Category,
  SupportedCurrency,
  Transaction,
  TransactionType,
} from "@/lib/types";

export type CsvFieldKey =
  | "date"
  | "amount"
  | "currency"
  | "fxRate"
  | "payee"
  | "note"
  | "type"
  | "category"
  | "account";

export type CsvMappings = Record<CsvFieldKey, string>;

export type ImportPreviewRow = {
  id: string;
  rowIndex: number;
  occurredOn: string;
  originalAmount: number;
  currency: SupportedCurrency;
  fxRateToUgx?: number;
  normalizedAmount: number;
  type: TransactionType | "";
  accountId: string;
  categoryId: string;
  payee: string;
  note: string;
  duplicate: boolean;
  issues: string[];
};

export const defaultCsvMappings: CsvMappings = {
  date: "",
  amount: "",
  currency: "",
  fxRate: "",
  payee: "",
  note: "",
  type: "",
  category: "",
  account: "",
};

export function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export function parseImportedType(value: string): TransactionType | "" {
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

export function parseImportedCurrency(value: string): SupportedCurrency | null {
  const normalized = normalizeName(value).toUpperCase();
  const supported = ["UGX", "USD", "KES", "TZS", "RWF", "EUR", "GBP"] as const;
  return supported.includes(normalized as SupportedCurrency)
    ? (normalized as SupportedCurrency)
    : null;
}

export function buildMessageHash(values: string[]) {
  const normalized = values.map((value) => value.trim().toLowerCase()).join("|");
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index);
    hash |= 0;
  }

  return `csv:${Math.abs(hash)}`;
}

export function detectDuplicate(
  preview: {
    accountId: string;
    occurredOn: string;
    amount: number;
    type: TransactionType | "";
    payee: string;
    note: string;
  },
  existing: Transaction[],
) {
  return existing.some(
    (transaction) =>
      transaction.accountId === preview.accountId &&
      transaction.occurredOn === preview.occurredOn &&
      transaction.amount === preview.amount &&
      transaction.type === preview.type &&
      (transaction.payee ?? transaction.rawPayee ?? "") === preview.payee &&
      (transaction.note ?? "") === preview.note,
  );
}

function getMappedValue(
  row: string[],
  field: CsvFieldKey,
  csvHeaders: string[],
  csvMappings: CsvMappings,
) {
  const header = csvMappings[field];
  if (!header) return "";
  const headerIndex = csvHeaders.indexOf(header);
  return headerIndex >= 0 ? (row[headerIndex] ?? "") : "";
}

export function buildImportPreviewRows(params: {
  rows: string[][];
  csvHeaders: string[];
  csvMappings: CsvMappings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  defaultImportType: Exclude<TransactionType, "transfer">;
  defaultImportAccountId: string;
  defaultImportCategoryId: string;
  defaultImportCurrency: SupportedCurrency;
  defaultImportFxRate: string;
}) {
  const {
    rows,
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
  } = params;

  const accountLookup = new Map(accounts.map((account) => [normalizeName(account.name), account.id]));
  const categoryLookup = new Map(
    categories.map((category) => [normalizeName(category.name), category.id]),
  );

  return rows.map<ImportPreviewRow>((row, index) => {
    const occurredOn = getMappedValue(row, "date", csvHeaders, csvMappings);
    const amountValue = Number(getMappedValue(row, "amount", csvHeaders, csvMappings));
    const importedType = parseImportedType(getMappedValue(row, "type", csvHeaders, csvMappings));
    const resolvedType = importedType || defaultImportType;
    const accountName = getMappedValue(row, "account", csvHeaders, csvMappings);
    const categoryName = getMappedValue(row, "category", csvHeaders, csvMappings);
    const payee = getMappedValue(row, "payee", csvHeaders, csvMappings);
    const note = getMappedValue(row, "note", csvHeaders, csvMappings);
    const importedCurrency =
      parseImportedCurrency(getMappedValue(row, "currency", csvHeaders, csvMappings)) ??
      defaultImportCurrency;
    const fxRateValue =
      importedCurrency === "UGX"
        ? undefined
        : Number(
            getMappedValue(row, "fxRate", csvHeaders, csvMappings) || defaultImportFxRate || 0,
          );
    const normalizedAmount = normalizeAmountToUgx(
      amountValue,
      importedCurrency,
      fxRateValue,
    );
    const resolvedAccountId =
      (accountName ? accountLookup.get(normalizeName(accountName)) : undefined) ??
      defaultImportAccountId;
    const resolvedCategoryId =
      (categoryName ? categoryLookup.get(normalizeName(categoryName)) : undefined) ??
      defaultImportCategoryId;
    const issues: string[] = [];

    if (!occurredOn) issues.push("Missing date");
    if (!Number.isFinite(amountValue) || amountValue <= 0) issues.push("Invalid amount");
    if (!resolvedType) issues.push("Missing type");
    if (resolvedType === "transfer") issues.push("Transfer import not supported in CSV flow");
    if (!resolvedAccountId) issues.push("Unresolved account");
    if (!resolvedCategoryId) issues.push("Unresolved category");
    if (importedCurrency !== "UGX" && (!Number.isFinite(fxRateValue) || Number(fxRateValue) <= 0)) {
      issues.push("Invalid FX rate");
    }
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      issues.push("Invalid normalized amount");
    }

    const duplicate = detectDuplicate(
      {
        accountId: resolvedAccountId,
        occurredOn,
        amount: Math.abs(normalizedAmount),
        type: resolvedType,
        payee,
        note,
      },
      transactions,
    );
    if (duplicate) issues.push("Likely duplicate");

    return {
      id: `preview:${index}`,
      rowIndex: index + 1,
      occurredOn,
      originalAmount: Math.abs(amountValue),
      currency: importedCurrency,
      fxRateToUgx: importedCurrency === "UGX" ? undefined : Number(fxRateValue),
      normalizedAmount: Math.abs(normalizedAmount),
      type: resolvedType,
      accountId: resolvedAccountId,
      categoryId: resolvedCategoryId,
      payee,
      note,
      duplicate,
      issues,
    };
  });
}
