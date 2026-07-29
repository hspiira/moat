import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { RecurringWorkspace } from "@/components/recurring-workspace";

export default function RecurringPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <RecurringWorkspace />
      </Suspense>
    </AppShell>
  );
}
