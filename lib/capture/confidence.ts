import type { CaptureFieldWarning, SupportedCurrency } from "@/lib/types";

export function buildCaptureFieldWarnings(params: {
  originalAmount: number;
  currency: SupportedCurrency;
  fxRateToUgx?: number;
  occurredOn?: string;
  payee?: string;
  categoryId?: string;
}) {
  const warnings: CaptureFieldWarning[] = [];

  if (!Number.isFinite(params.originalAmount) || params.originalAmount <= 0) {
    warnings.push({ field: "amount", level: "warning", message: "Amount could not be read reliably." });
  }

  if (!params.occurredOn) {
    warnings.push({ field: "date", level: "warning", message: "Date was not found in the captured text." });
  }

  if (!params.payee?.trim()) {
    warnings.push({ field: "payee", level: "info", message: "Payee or counterparty could not be identified." });
  }

  if (!params.categoryId) {
    warnings.push({ field: "type", level: "info", message: "Category needs review before posting." });
  }

  if (params.currency !== "UGX" && (!params.fxRateToUgx || params.fxRateToUgx <= 0)) {
    warnings.push({ field: "currency", level: "warning", message: "FX rate is required to convert this amount to UGX." });
  }

  return warnings;
}

export function deriveCaptureConfidence(params: {
  baseBoost: number;
  originalAmount: number;
  occurredOn?: string;
  payee?: string;
  categoryId?: string;
  warningCount: number;
}) {
  let confidence = 0.35 + params.baseBoost;

  if (Number.isFinite(params.originalAmount) && params.originalAmount > 0) {
    confidence += 0.2;
  }

  if (params.occurredOn) confidence += 0.1;
  if (params.payee?.trim()) confidence += 0.1;
  if (params.categoryId) confidence += 0.1;

  confidence -= params.warningCount * 0.05;

  return Math.max(0.1, Math.min(0.95, confidence));
}
