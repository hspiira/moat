import { AppShell } from "@/components/app-shell";
import { HomeOverview } from "@/components/home-overview";
import {
  appSections,
  implementationMilestones,
  modulePreviews,
  productHighlights,
} from "@/lib/data";

export default function HomePage() {
  return (
    <AppShell>
      <HomeOverview
        sections={appSections}
        milestones={implementationMilestones}
        highlights={productHighlights}
        modulePreviews={modulePreviews}
      />
    </AppShell>
  );
}
