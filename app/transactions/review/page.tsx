import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsCaptureReviewWorkspace } from "@/components/transactions-capture-review-workspace";

// Opening "review" lands on the capture inbox: that is the queue with items
// waiting on a decision. Month close is a once-a-month ritual and lives at
// /transactions/review/month-close.
export default function TransactionsReviewPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsCaptureReviewWorkspace />
      </Suspense>
    </AppShell>
  );
}
