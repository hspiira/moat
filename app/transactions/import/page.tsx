import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { TransactionsImportWorkspace } from "@/components/transactions-import-workspace";

export default function TransactionsImportPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <TransactionsImportWorkspace />
      </Suspense>
    </AppShell>
  );
}
