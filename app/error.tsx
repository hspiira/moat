"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure for debugging without leaking details to the UI.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-content-center gap-5 px-4 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10">
        <IconAlertTriangle className="size-7 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          This screen ran into a problem
        </h1>
        <p className="text-sm text-muted-foreground">
          Your data is safe on this device. Try again, and if it keeps happening, reload the app.
        </p>
      </div>
      <div className="flex justify-center gap-2">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Go to overview</Link>
        </Button>
      </div>
    </div>
  );
}
