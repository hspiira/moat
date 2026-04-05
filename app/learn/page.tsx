import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { moduleDetails } from "@/lib/data";

export default function LearnPage() {
  return (
    <AppShell>
      <ModulePage detail={moduleDetails.learn} />
    </AppShell>
  );
}
