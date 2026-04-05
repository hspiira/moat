import { DashboardShell } from "@/components/dashboard-shell";
import { appSections, implementationMilestones, productHighlights } from "@/lib/data";

export default function HomePage() {
  return (
    <DashboardShell
      sections={appSections}
      milestones={implementationMilestones}
      highlights={productHighlights}
    />
  );
}
