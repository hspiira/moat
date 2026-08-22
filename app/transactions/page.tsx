import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsLedgerWorkspace } from "@/components/transactions-ledger-workspace";

export default function TransactionsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsLedgerWorkspace />
      </Suspense>
    </AppShell>
  );
}
