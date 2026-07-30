import { redirect } from "next/navigation";

// The capture inbox moved up to /transactions/review. Kept so existing links
// and any installed-PWA shortcuts still land somewhere correct.
export default function TransactionsCaptureReviewRedirect() {
  redirect("/transactions/review");
}
