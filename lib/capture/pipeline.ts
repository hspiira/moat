import { normalizeAmountToUgx } from "@/lib/currency";
import { buildStableHash } from "@/lib/hash";
import { buildCaptureFieldWarnings, deriveCaptureConfidence } from "@/lib/capture/confidence";
import { detectCaptureDuplicate } from "@/lib/capture/deduplication";
import {
  inferCaptureCurrency,
  inferCapturePayee,
  inferCaptureType,
  parseCaptureAmount,
  parseCaptureDate,
  splitCaptureMessages,
} from "@/lib/capture/normalizers";
import { parseWithProviderPacks } from "@/lib/capture/providers";
import type { CapturePipelineCandidate, CapturePipelineInput } from "@/lib/capture/types";
import type { CategoryKind, CaptureReviewItem } from "@/lib/types";

function inferCategoryId(
  categories: CapturePipelineInput["categories"],
  type: CapturePipelineCandidate["type"],
) {
  const kind: CategoryKind =
    type === "income" ? "income" : type === "savings_contribution" ? "savings" : "expense";

  return categories.find((category) => category.kind === kind)?.id ?? "";
}

export function parseCaptureEnvelope(input: CapturePipelineInput & { existingReviewItems?: CaptureReviewItem[] }) {
  const messages = splitCaptureMessages(input.envelope.rawContent);

  return messages.map<CapturePipelineCandidate>((rawText, index) => {
    const providerResult = parseWithProviderPacks(rawText);
    const type = providerResult?.type ?? inferCaptureType(rawText);
    const currency = providerResult?.currency ?? inferCaptureCurrency(rawText);
    const originalAmount = Math.abs(providerResult?.originalAmount ?? parseCaptureAmount(rawText));
    const fxRateToUgx =
      currency === "UGX"
        ? undefined
        : input.fallbackFxRate && input.fallbackFxRate > 0
          ? input.fallbackFxRate
          : undefined;
    const occurredOn = providerResult?.occurredOn ?? parseCaptureDate(rawText);
    const categoryId = inferCategoryId(input.categories, type);
    const payee = providerResult?.payee ?? inferCapturePayee(rawText);
    const normalizedAmount = normalizeAmountToUgx(originalAmount, currency, fxRateToUgx);
    const messageHash = buildStableHash(
      [input.source, input.envelope.sourceApp ?? "", rawText, occurredOn, String(originalAmount)],
      "capture",
    );
    const fieldWarnings = buildCaptureFieldWarnings({
      originalAmount,
      currency,
      fxRateToUgx,
      occurredOn,
      payee,
      categoryId,
    });
    const confidence = deriveCaptureConfidence({
      baseBoost: providerResult?.confidenceBoost ?? 0,
      originalAmount,
      occurredOn,
      payee,
      categoryId,
      warningCount: fieldWarnings.length,
    });
    const issues = fieldWarnings
      .filter((warning) => warning.level === "warning")
      .map((warning) => warning.message);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      issues.push("Invalid normalized amount");
    }

    const candidate: CapturePipelineCandidate = {
      id: `capture:${index}:${messageHash}`,
      rawText,
      occurredOn,
      originalAmount,
      currency,
      fxRateToUgx,
      normalizedAmount,
      type,
      categoryId,
      accountId: input.accountId,
      payee,
      note: providerResult?.note ?? rawText,
      source: input.source,
      sourceEnvelopeId: input.envelope.id,
      sourceApp: input.envelope.sourceApp,
      providerId: providerResult?.providerId,
      parserLabel: providerResult?.parserLabel,
      messageHash,
      confidence,
      fieldWarnings,
      duplicate: false,
      issues,
    };

    const duplicate = detectCaptureDuplicate({
      candidate,
      existingTransactions: input.existingTransactions,
      existingReviewItems: input.existingReviewItems,
    });

    if (duplicate?.transactionId) {
      candidate.duplicate = true;
      candidate.duplicateTransactionId = duplicate.transactionId;
      candidate.issues = [...candidate.issues, "Likely duplicate"];
    }

    if (duplicate?.reviewItemId) {
      candidate.duplicate = true;
      candidate.duplicateCaptureReviewItemId = duplicate.reviewItemId;
      candidate.issues = [...candidate.issues, "Likely duplicate in capture inbox"];
    }

    return candidate;
  });
}
