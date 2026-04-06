import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsReviewWorkspace } from "@/components/transactions-review-workspace";

export default function TransactionsReviewPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsReviewWorkspace />
      </Suspense>
    </AppShell>
  );
}
