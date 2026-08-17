import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsReviewWorkspace } from "@/components/transactions-review-workspace";

export default function MonthCheckPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsReviewWorkspace />
      </Suspense>
    </AppShell>
  );
}
