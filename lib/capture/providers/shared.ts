import type { SupportedCurrency } from "@/lib/types";

export function normalizeCurrency(value: string): SupportedCurrency {
  const upper = value.toUpperCase();
  if (upper === "USH") return "UGX";
  if (upper === "UGX" || upper === "USD" || upper === "KES" || upper === "TZS" || upper === "RWF" || upper === "EUR" || upper === "GBP") {
    return upper;
  }
  return "UGX";
}

export function parseAmount(value: string) {
  return Number(value.replace(/,/g, ""));
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function cleanCapturePayee(raw: string): string {
  return raw
    .split(/\s+on\s|\.\s|\s*\bFee\b|\s*\bTax\b|\n|,\s*(?=\d)/i)[0]
    .trim()
    .replace(/[.,\s]+$/, "");
}

export function parseCaptureFee(text: string): number | undefined {
  const matches = text.matchAll(
    /\b(?:excise\s+duty|fee|tax|charge)s?\s*:?\s*(?:UGX|USh)?\s*([0-9,]+(?:\.\d+)?)/gi,
  );
  let total = 0;
  let found = false;
  for (const match of matches) {
    total += parseAmount(match[1]);
    found = true;
  }
  return found && total > 0 ? total : undefined;
}

export function toIsoDate(value?: string) {
  if (!value) return undefined;
  const iso = value.match(/(20\d{2})[-/](\d{2})[-/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = value.match(/(\d{2})[-/](\d{2})[-/](20\d{2})/);
  if (uk) return `${uk[3]}-${uk[2]}-${uk[1]}`;
  const named = value.match(/(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](20\d{2})/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, "0")}`;
  }
  return undefined;
}
