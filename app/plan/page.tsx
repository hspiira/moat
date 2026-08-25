import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { MonthlyPlanWorkspace } from "@/components/monthly-plan-workspace";

export default function MonthlyPlanPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <MonthlyPlanWorkspace />
      </Suspense>
    </AppShell>
  );
}
