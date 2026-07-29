import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { DebtWorkspace } from "@/components/debt-workspace";

export default function DebtPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <DebtWorkspace />
      </Suspense>
    </AppShell>
  );
}
