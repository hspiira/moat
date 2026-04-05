import { AppShell } from "@/components/app-shell";
import { OnboardingWorkspace } from "@/components/onboarding-workspace";

/**
 * Renders the onboarding workspace within the application's AppShell.
 *
 * @returns A JSX element containing `AppShell` with `OnboardingWorkspace` as its child.
 */
export default function OnboardingPage() {
  return (
    <AppShell>
      <OnboardingWorkspace />
    </AppShell>
  );
}
