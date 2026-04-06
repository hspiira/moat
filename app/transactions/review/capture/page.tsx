import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsCaptureReviewWorkspace } from "@/components/transactions-capture-review-workspace";

export default function TransactionsCaptureReviewPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsCaptureReviewWorkspace />
      </Suspense>
    </AppShell>
  );
}
