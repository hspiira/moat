import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { ProjectsWorkspace } from "@/components/projects-workspace";

export default function ProjectsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <ProjectsWorkspace />
      </Suspense>
    </AppShell>
  );
}
