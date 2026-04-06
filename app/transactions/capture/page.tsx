import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsCaptureWorkspace } from "@/components/transactions-capture-workspace";

export default function TransactionsCapturePage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsCaptureWorkspace />
      </Suspense>
    </AppShell>
  );
}
