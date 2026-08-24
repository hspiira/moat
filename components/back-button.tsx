"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.back()}>
      <IconArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
