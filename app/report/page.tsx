import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { ReportWorkspace } from "@/components/report-workspace";

export default function ReportPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ReportWorkspace />
      </Suspense>
    </AppShell>
  );
}
