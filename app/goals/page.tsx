import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { moduleDetails } from "@/lib/data";

export default function GoalsPage() {
  return (
    <AppShell>
      <ModulePage detail={moduleDetails.goals} />
    </AppShell>
  );
}
