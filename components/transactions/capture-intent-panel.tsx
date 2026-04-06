"use client";

import { Card, CardContent } from "@/components/ui/card";

export type CaptureIntent = "expense" | "income" | "transfer" | "import" | "text" | null;

const captureCopy: Record<Exclude<CaptureIntent, null>, { title: string; body: string }> = {
  expense: {
    title: "Quick expense capture",
    body: "The transaction form is preset for an expense. Record the amount, payee, and category, then save.",
  },
  income: {
    title: "Quick income capture",
    body: "The transaction form is preset for incoming money. Add the source, amount, and account, then save.",
  },
  transfer: {
    title: "Quick transfer capture",
    body: "The transaction form is preset for a transfer. Select the source and destination accounts before saving.",
  },
  import: {
    title: "Quick import capture",
    body: "Use the CSV import panel below for statement-style capture without crowding the main ledger.",
  },
  text: {
    title: "Quick text capture",
    body: "Paste SMS or notification text, review the extracted candidates, then send them into the capture inbox.",
  },
};

export function CaptureIntentPanel({ intent }: { intent: CaptureIntent }) {
  if (!intent) return null;

  const copy = captureCopy[intent];

  return (
    <Card className="border-border/20 bg-muted/20 shadow-none lg:hidden">
      <CardContent className="grid gap-1 px-4 py-3">
        <div className="text-sm font-medium text-foreground">{copy.title}</div>
        <div className="text-xs leading-5 text-muted-foreground">{copy.body}</div>
      </CardContent>
    </Card>
  );
}
