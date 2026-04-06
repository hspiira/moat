import { createPastedTextEnvelope } from "@/lib/capture/source-adapters/pasted-text";
import { createSharedTextEnvelope } from "@/lib/capture/source-adapters/shared-text";
import { parseCaptureEnvelope } from "@/lib/capture/pipeline";
import type { CapturePipelineCandidate } from "@/lib/capture/types";
import type { Category, Transaction, TransactionSource } from "@/lib/types";

export type ParsedCaptureCandidate = CapturePipelineCandidate;

export function parseCaptureText(params: {
  input: string;
  source: TransactionSource;
  accountId: string;
  categories: Category[];
  existingTransactions: Transaction[];
  fallbackFxRate?: number;
  hasSharedInput?: boolean;
}) {
  const envelope = params.hasSharedInput
    ? createSharedTextEnvelope({
        userId: "preview-user",
        rawContent: params.input,
      })
    : createPastedTextEnvelope({
        userId: "preview-user",
        rawContent: params.input,
      });

  return parseCaptureEnvelope({
    envelope,
    source: params.source,
    accountId: params.accountId,
    fallbackFxRate: params.fallbackFxRate,
    categories: params.categories,
    existingTransactions: params.existingTransactions,
  });
}
