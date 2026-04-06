import type {
  CaptureEnvelope,
  CaptureFieldWarning,
  SupportedCurrency,
  Transaction,
  TransactionSource,
  TransactionType,
} from "@/lib/types";

export type CaptureProviderResult = {
  providerId: string;
  parserLabel: string;
  type: Exclude<TransactionType, "transfer">;
  currency: SupportedCurrency;
  originalAmount: number;
  occurredOn?: string;
  payee?: string;
  note?: string;
  confidenceBoost: number;
};

export type CapturePipelineCandidate = {
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
  sourceEnvelopeId?: string;
  sourceApp?: string;
  providerId?: string;
  parserLabel?: string;
  messageHash: string;
  confidence: number;
  fieldWarnings: CaptureFieldWarning[];
  duplicate: boolean;
  duplicateTransactionId?: string;
  duplicateCaptureReviewItemId?: string;
  issues: string[];
};

export type CapturePipelineInput = {
  envelope: CaptureEnvelope;
  source: TransactionSource;
  accountId: string;
  fallbackFxRate?: number;
  categories: {
    id: string;
    kind: "income" | "expense" | "savings" | "transfer";
  }[];
  existingTransactions: Transaction[];
};
