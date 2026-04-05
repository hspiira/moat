"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";

type LocalSaveFeedbackProps = {
  isSubmitting: boolean;
  lastSavedAt: string | null;
  successMessage: string | null;
};

function formatSavedAt(timestamp: string) {
  return new Intl.DateTimeFormat("en-UG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function LocalSaveFeedback({
  isSubmitting,
  lastSavedAt,
  successMessage,
}: LocalSaveFeedbackProps) {
  const helperText = useMemo(() => {
    if (isSubmitting) {
      return "Saving locally on this device...";
    }

    if (lastSavedAt && successMessage) {
      return `${successMessage} at ${formatSavedAt(lastSavedAt)}.`;
    }

    return "Changes stay on this device until sync exists.";
  }, [isSubmitting, lastSavedAt, successMessage]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant={isSubmitting ? "secondary" : "outline"}>
        {isSubmitting ? "Saving" : "Local save"}
      </Badge>
      <span>{helperText}</span>
    </div>
  );
}
