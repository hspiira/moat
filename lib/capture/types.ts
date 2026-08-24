import type { CategoryLike } from "@/lib/domain/transaction-classification";
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
  type: TransactionType;
  currency: SupportedCurrency;
  originalAmount: number;
  occurredOn?: string;
  payee?: string;
  note?: string;
  feeAmount?: number;
  confidenceBoost: number;
};

export type CapturePipelineCandidate = {
  id: string;
  rawText: string;
  occurredOn: string;
  originalAmount: number;
  currency: SupportedCurrency;
  fxRateToUgx?: number;
  feeAmount?: number;
  statedBalance?: number;
  normalizedAmount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  /** Where a transfer lands. Chosen on review, since a message rarely says. */
  destinationAccountId?: string;
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
  categories: CategoryLike[];
  existingTransactions: Transaction[];
};
