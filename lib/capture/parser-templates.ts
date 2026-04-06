import type { SupportedCurrency, TransactionType } from "@/lib/types";

export type ParserTemplateResult = {
  templateId: string;
  type: Exclude<TransactionType, "transfer">;
  currency: SupportedCurrency;
  originalAmount: number;
  occurredOn?: string;
  payee?: string;
  note?: string;
  confidenceBoost: number;
};

type ParserTemplate = {
  id: string;
  match: (text: string) => ParserTemplateResult | null;
};

function normalizeCurrency(value: string): SupportedCurrency {
  const upper = value.toUpperCase();
  if (upper === "USH") return "UGX";
  if (upper === "UGX" || upper === "USD" || upper === "KES" || upper === "TZS" || upper === "RWF" || upper === "EUR" || upper === "GBP") {
    return upper;
  }
  return "UGX";
}

function parseAmount(value: string) {
  return Number(value.replace(/,/g, ""));
}

function toIsoDate(value?: string) {
  if (!value) return undefined;
  const iso = value.match(/(20\d{2})[-/](\d{2})[-/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = value.match(/(\d{2})[-/](\d{2})[-/](20\d{2})/);
  if (uk) return `${uk[3]}-${uk[2]}-${uk[1]}`;
  return undefined;
}

const mtnIncoming: ParserTemplate = {
  id: "mtn-incoming",
  match(text) {
    const match = text.match(/received\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)\s+from\s+(.+?)(?:\s+on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i);
    if (!match) return null;
    return {
      templateId: this.id,
      type: "income",
      currency: normalizeCurrency(match[1]),
      originalAmount: parseAmount(match[2]),
      payee: match[3]?.trim(),
      occurredOn: toIsoDate(match[4]),
      note: text,
      confidenceBoost: 0.35,
    };
  },
};

const airtelOutgoing: ParserTemplate = {
  id: "airtel-outgoing",
  match(text) {
    const match = text.match(/(?:paid|sent)\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)\s+to\s+(.+?)(?:\s+on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i);
    if (!match) return null;
    return {
      templateId: this.id,
      type: "expense",
      currency: normalizeCurrency(match[1]),
      originalAmount: parseAmount(match[2]),
      payee: match[3]?.trim(),
      occurredOn: toIsoDate(match[4]),
      note: text,
      confidenceBoost: 0.3,
    };
  },
};

const bankCredited: ParserTemplate = {
  id: "bank-credited",
  match(text) {
    const match = text.match(/(?:acct|account).+?credited(?:\s+with)?\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)(?:.*?from\s+(.+?))?(?:.*?on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i);
    if (!match) return null;
    return {
      templateId: this.id,
      type: "income",
      currency: normalizeCurrency(match[1]),
      originalAmount: parseAmount(match[2]),
      payee: match[3]?.trim(),
      occurredOn: toIsoDate(match[4]),
      note: text,
      confidenceBoost: 0.35,
    };
  },
};

const bankDebited: ParserTemplate = {
  id: "bank-debited",
  match(text) {
    const match = text.match(/(?:acct|account).+?debited(?:\s+by| with)?\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)(?:.*?(?:to|at)\s+(.+?))?(?:.*?on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i);
    if (!match) return null;
    return {
      templateId: this.id,
      type: "expense",
      currency: normalizeCurrency(match[1]),
      originalAmount: parseAmount(match[2]),
      payee: match[3]?.trim(),
      occurredOn: toIsoDate(match[4]),
      note: text,
      confidenceBoost: 0.35,
    };
  },
};

const templates: ParserTemplate[] = [mtnIncoming, airtelOutgoing, bankCredited, bankDebited];

export function parseWithTemplates(text: string) {
  for (const template of templates) {
    const result = template.match(text);
    if (result) return result;
  }

  return null;
}
