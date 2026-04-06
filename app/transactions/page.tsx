import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsWorkspace } from "@/components/transactions-workspace";

export default function TransactionsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsWorkspace />
      </Suspense>
    </AppShell>
  );
}
