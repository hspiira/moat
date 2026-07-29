import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { BudgetsWorkspace } from "@/components/budgets-workspace";

export default function BudgetsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <BudgetsWorkspace />
      </Suspense>
    </AppShell>
  );
}
