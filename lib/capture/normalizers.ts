import type { SupportedCurrency, TransactionType } from "@/lib/types";

const supportedCurrencies = ["UGX", "USD", "KES", "TZS", "RWF", "EUR", "GBP"] as const;

export function normalizeCaptureName(value: string) {
  return value.trim().toLowerCase();
}

export function splitCaptureMessages(input: string) {
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

export function inferCaptureType(text: string): Exclude<TransactionType, "transfer"> {
  const normalized = normalizeCaptureName(text);

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

export function inferCaptureCurrency(text: string): SupportedCurrency {
  const upper = text.toUpperCase();
  const matched = supportedCurrencies.find((currency) => upper.includes(currency));
  if (matched) return matched;
  if (/\bUSH\b|\bUGX\b/.test(upper)) return "UGX";
  return "UGX";
}

export function parseCaptureAmount(text: string) {
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

export function parseCaptureDate(text: string) {
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

export function inferCapturePayee(text: string) {
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
