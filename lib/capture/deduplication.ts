import type { CapturePipelineCandidate } from "@/lib/capture/types";
import type { CaptureReviewItem, Transaction } from "@/lib/types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function detectCaptureDuplicate(params: {
  candidate: Pick<
    CapturePipelineCandidate,
    "messageHash" | "accountId" | "occurredOn" | "type" | "normalizedAmount" | "payee" | "note"
  >;
  existingTransactions: Transaction[];
  existingReviewItems?: CaptureReviewItem[];
}) {
  const matchingTransaction =
    params.existingTransactions.find(
      (transaction) =>
        transaction.messageHash === params.candidate.messageHash ||
        (transaction.accountId === params.candidate.accountId &&
          transaction.occurredOn === params.candidate.occurredOn &&
          transaction.type === params.candidate.type &&
          transaction.amount === params.candidate.normalizedAmount &&
          normalize(transaction.payee ?? transaction.rawPayee ?? "") ===
            normalize(params.candidate.payee) &&
          normalize(transaction.note ?? "") === normalize(params.candidate.note)),
    ) ?? null;

  if (matchingTransaction) {
    return { transactionId: matchingTransaction.id };
  }

  const matchingReviewItem =
    params.existingReviewItems?.find(
      (item) =>
        item.messageHash === params.candidate.messageHash ||
        (item.accountId === params.candidate.accountId &&
          item.occurredOn === params.candidate.occurredOn &&
          item.type === params.candidate.type &&
          item.normalizedAmount === params.candidate.normalizedAmount &&
          normalize(item.payee) === normalize(params.candidate.payee) &&
          normalize(item.note) === normalize(params.candidate.note)),
    ) ?? null;

  if (matchingReviewItem) {
    return { reviewItemId: matchingReviewItem.id };
  }

  return null;
}
