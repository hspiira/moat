import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { SignInCallbackWorkspace } from "@/components/sync/sign-in-callback-workspace";

export default function SignInCallbackPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <SignInCallbackWorkspace />
      </Suspense>
    </AppShell>
  );
}
