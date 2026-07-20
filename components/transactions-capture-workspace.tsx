"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconMessage2, IconPencilPlus } from "@tabler/icons-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CaptureIntentPanel } from "./transactions/capture-intent-panel";
import { TextCapturePanel } from "./transactions/text-capture-panel";
import { TransactionForm } from "./transactions/transaction-form";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

type CaptureMethod = "manual" | "message";

const methodCards: {
  id: CaptureMethod;
  title: string;
  description: string;
  icon: typeof IconPencilPlus;
}[] = [
  {
    id: "manual",
    title: "Enter manually",
    description: "Type one transaction against an account.",
    icon: IconPencilPlus,
  },
  {
    id: "message",
    title: "From a message",
    description: "Paste an SMS or notification, or upload a screenshot, to extract transactions.",
    icon: IconMessage2,
  },
];

function methodFromCaptureParam(param: string | null): CaptureMethod | null {
  if (param === "text") return "message";
  if (param === "expense" || param === "income" || param === "transfer") return "manual";
  return null;
}

export function TransactionsCaptureWorkspace() {
  const workspace = useTransactionsWorkspace();
  const searchParams = useSearchParams();
  // Open the matching method straight away when arriving from a quick-capture
  // link (the "+" sheet or a share target), so those routes land on the form.
  const [method, setMethod] = useState<CaptureMethod | null>(() =>
    methodFromCaptureParam(searchParams.get("capture")),
  );

  return (
    <TransactionsWorkspaceFrame
      currentRoute="capture"
      title="Capture"
      description="Manual entry and pasted text intake stay here so the main ledger stays clean."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      transactionCount={workspace.transactions.length}
      periodTransactionCount={workspace.periodTransactions.length}
      reviewCount={workspace.reviewCount + workspace.captureReviewCount}
      duplicateCount={workspace.duplicateCount}
      periodSummary={workspace.periodSummary}
    >
      <div className="grid gap-5">
        <CaptureIntentPanel intent={workspace.captureIntent} />

        <div className="grid gap-3 sm:grid-cols-2">
          {methodCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setMethod(card.id)}
                className="flex items-start gap-3 rounded-md border border-border/60 bg-card px-4 py-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">{card.title}</span>
                  <span className="text-sm leading-6 text-muted-foreground">{card.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Sheet
        open={method !== null}
        onOpenChange={(open) => setMethod(open ? (method ?? "manual") : null)}
      >
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-4 sm:max-w-lg">
          <SheetHeader className="sr-only">
            <SheetTitle>Capture a transaction</SheetTitle>
            <SheetDescription>
              Enter a transaction manually or extract it from a message.
            </SheetDescription>
          </SheetHeader>

          {/* Segmented switcher — swaps the method in place, no navigation.
              Active segment is a raised light chip so it never reads as the
              focus ring on the other segment. */}
          <div
            role="tablist"
            aria-label="Capture method"
            className="mt-6 mb-4 grid grid-cols-2 gap-1 rounded-md bg-muted/60 p-1"
          >
            {methodCards.map((card) => (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={method === card.id}
                onClick={() => setMethod(card.id)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  method === card.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {card.id === "manual" ? "Manual" : "From a message"}
              </button>
            ))}
          </div>

          {method === "manual" ? (
            <TransactionForm
              embedded
              accounts={workspace.accounts}
              categories={workspace.categories}
              form={workspace.transactionForm}
              editingId={workspace.editingTransactionId}
              isSubmitting={workspace.isSubmitting}
              lastSavedAt={workspace.lastSavedAt}
              successMessage={workspace.successMessage}
              rememberedFxHint={workspace.rememberedFxHint}
              onFormChange={workspace.setTransactionForm}
              onSubmit={(event) => void workspace.handleTransactionSubmit(event)}
              onCancelEdit={workspace.cancelEdit}
            />
          ) : method === "message" ? (
            <TextCapturePanel
              embedded
              active
              accounts={workspace.accounts}
              categories={workspace.categories}
              existingTransactions={workspace.transactions}
              isSubmitting={workspace.isSubmitting}
              initialInput={workspace.sharedCaptureInput}
              onSaveCaptured={workspace.saveCapturedTransactions}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </TransactionsWorkspaceFrame>
  );
}
