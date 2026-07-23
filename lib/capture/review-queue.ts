// Barrel for the capture review-queue modules. Kept so existing importers of
// `@/lib/capture/review-queue` keep working after the split by responsibility:
//   - review-item-factory: validate + construct review items, open-item selector
//   - transaction-factory:  turn an approved review item into a Transaction
//   - correction-log:       record the original-vs-approved correction

export {
  validateCaptureReviewItem,
  createCaptureReviewItem,
  getOpenCaptureReviewItems,
} from "@/lib/capture/review-item-factory";

export {
  mapReviewItemToTransactionFields,
  buildTransactionFromCaptureReviewItem,
} from "@/lib/capture/transaction-factory";

export { createCorrectionLog } from "@/lib/capture/correction-log";
