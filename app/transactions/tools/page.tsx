import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsToolsWorkspace } from "@/components/transactions-tools-workspace";

export default function TransactionsToolsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsToolsWorkspace />
      </Suspense>
    </AppShell>
  );
}
