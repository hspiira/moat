import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CategoriesWorkspace } from "@/components/categories-workspace";

export const metadata: Metadata = {
  title: "Categories | Moat",
};

export default function CategoriesPage() {
  return (
    <AppShell>
      <CategoriesWorkspace />
    </AppShell>
  );
}
