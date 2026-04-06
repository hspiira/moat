import { normalizeAmountToUgx } from "@/lib/currency";
import { buildStableHash } from "@/lib/hash";
import { parseWithTemplates } from "@/lib/capture/parser-templates";
import type {
  Category,
  SupportedCurrency,
  Transaction,
  TransactionSource,
  TransactionType,
} from "@/lib/types";

export type ParsedCaptureCandidate = {
  id: string;
  rawText: string;
  occurredOn: string;
  originalAmount: number;
  currency: SupportedCurrency;
  fxRateToUgx?: number;
  normalizedAmount: number;
  type: Exclude<TransactionType, "transfer">;
  categoryId: string;
  accountId: string;
  payee: string;
  note: string;
  source: TransactionSource;
  messageHash: string;
  parserLabel?: string;
  confidence: number;
  duplicate: boolean;
  issues: string[];
};

const supportedCurrencies = ["UGX", "USD", "KES", "TZS", "RWF", "EUR", "GBP"] as const;

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function splitMessages(input: string) {
  const blockSplit = input
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (blockSplit.length > 1) {
    return blockSplit;
  }

  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function inferType(text: string): Exclude<TransactionType, "transfer"> {
  const normalized = normalizeName(text);

  if (/(salary|received|deposit|credited|cash in|payment received|sent you)/.test(normalized)) {
    return "income";
  }

  if (/(loan repayment|loan paid|repayment|installment|instalment)/.test(normalized)) {
    return "debt_payment";
  }

  if (/(save|savings|deposit to savings|sacco contribution)/.test(normalized)) {
    return "savings_contribution";
  }

  return "expense";
}

function inferCurrency(text: string): SupportedCurrency {
  const upper = text.toUpperCase();
  const matched = supportedCurrencies.find((currency) => upper.includes(currency));
  if (matched) return matched;
  if (/\bUSH\b|\bUGX\b/.test(upper)) return "UGX";
  return "UGX";
}

function parseAmount(text: string) {
  const normalized = text.replace(/,/g, "");
  const directCurrencyMatch = normalized.match(
    /\b(?:UGX|USH|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9]+(?:\.[0-9]+)?)/i,
  );
  if (directCurrencyMatch) {
    return Number(directCurrencyMatch[1]);
  }

  const generic = normalized.match(/([0-9]{1,3}(?:[0-9]{3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/);
  return generic ? Number(generic[1]) : Number.NaN;
}

function parseDate(text: string) {
  const isoMatch = text.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const ukMatch = text.match(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/);
  if (ukMatch) {
    return `${ukMatch[3]}-${ukMatch[2]}-${ukMatch[1]}`;
  }

  return new Date().toISOString().slice(0, 10);
}

function inferPayee(text: string) {
  const patterns = [
    /\bfrom\s+([A-Za-z0-9 .,&'-]+)/i,
    /\bto\s+([A-Za-z0-9 .,&'-]+)/i,
    /\bat\s+([A-Za-z0-9 .,&'-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\s+on\s+\d{2}[-/]\d{2}[-/]\d{4}.*/i, "")
        .replace(/\s+on\s+20\d{2}[-/]\d{2}[-/]\d{2}.*/i, "")
        .trim()
        .replace(/[.]+$/, "");
    }
  }

  return "";
}

function inferCategoryId(categories: Category[], type: Exclude<TransactionType, "transfer">) {
  if (type === "income") {
    return categories.find((category) => category.kind === "income")?.id ?? "";
  }
  if (type === "savings_contribution") {
    return categories.find((category) => category.kind === "savings")?.id ?? "";
  }
  return categories.find((category) => category.kind === "expense")?.id ?? "";
}

function detectDuplicate(candidate: ParsedCaptureCandidate, existing: Transaction[]) {
  return existing.some(
    (transaction) =>
      transaction.messageHash === candidate.messageHash ||
      (transaction.accountId === candidate.accountId &&
        transaction.occurredOn === candidate.occurredOn &&
        transaction.type === candidate.type &&
        transaction.amount === candidate.normalizedAmount &&
        normalizeName(transaction.payee ?? transaction.rawPayee ?? "") ===
          normalizeName(candidate.payee) &&
        normalizeName(transaction.note ?? "") === normalizeName(candidate.note)),
  );
}

export function parseCaptureText(params: {
  input: string;
  source: TransactionSource;
  accountId: string;
  categories: Category[];
  existingTransactions: Transaction[];
  fallbackFxRate?: number;
}) {
  const messages = splitMessages(params.input);

  return messages.map<ParsedCaptureCandidate>((rawText, index) => {
    const source = params.source;
    const templateMatch = parseWithTemplates(rawText);
    const type = templateMatch?.type ?? inferType(rawText);
    const currency = templateMatch?.currency ?? inferCurrency(rawText);
    const originalAmount = Math.abs(templateMatch?.originalAmount ?? parseAmount(rawText));
    const fxRateToUgx =
      currency === "UGX" ? undefined : params.fallbackFxRate && params.fallbackFxRate > 0 ? params.fallbackFxRate : undefined;
    const normalizedAmount = normalizeAmountToUgx(originalAmount, currency, fxRateToUgx);
    const occurredOn = templateMatch?.occurredOn ?? parseDate(rawText);
    const payee = templateMatch?.payee ?? inferPayee(rawText);
    const categoryId = inferCategoryId(params.categories, type);
    const messageHash = buildStableHash([source, rawText, occurredOn, String(originalAmount)], "capture");
    const issues: string[] = [];
    let confidence = 0.35 + (templateMatch?.confidenceBoost ?? 0);

    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      issues.push("Invalid amount");
    } else {
      confidence += 0.2;
    }

    if (occurredOn) confidence += 0.1;
    if (payee) confidence += 0.1;
    if (categoryId) confidence += 0.1;

    if (currency !== "UGX" && !fxRateToUgx) {
      issues.push("Missing FX rate");
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      issues.push("Invalid normalized amount");
    }

    const candidate: ParsedCaptureCandidate = {
      id: `capture:${index}:${messageHash}`,
      rawText,
      occurredOn,
      originalAmount,
      currency,
      fxRateToUgx,
      normalizedAmount,
      type,
      categoryId,
      accountId: params.accountId,
      payee,
      note: templateMatch?.note ?? rawText,
      source,
      messageHash,
      parserLabel: templateMatch?.templateId,
      confidence: Math.min(0.95, confidence),
      duplicate: false,
      issues,
    };

    candidate.duplicate = detectDuplicate(candidate, params.existingTransactions);
    if (candidate.duplicate) {
      candidate.issues.push("Likely duplicate");
    }

    return candidate;
  });
}
