"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { todayIso } from "@/lib/today";
import { categoryMatchesType } from "@/lib/domain/transaction-classification";
import type { TransactionType } from "@/lib/types";
import { TextCapturePanel } from "./transactions/text-capture-panel";
import { TransactionForm } from "./transactions/transaction-form";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";

type CaptureMethod = "manual" | "message";

const methods: { id: CaptureMethod; label: string }[] = [
  { id: "manual", label: "Enter manually" },
  { id: "message", label: "From a message" },
];

function methodFromCaptureParam(param: string | null): CaptureMethod | null {
  if (param === "text") return "message";
  if (param === "expense" || param === "income" || param === "transfer") return "manual";
  return null;
}

function typeFromCaptureParam(param: string | null): TransactionType | null {
  if (param === "expense" || param === "income" || param === "transfer") return param;
  return null;
}

export function TransactionsCaptureWorkspace() {
  const workspace = useTransactionsWorkspace();
  const searchParams = useSearchParams();
  const captureParam = searchParams.get("capture");
  const [method, setMethod] = useState<CaptureMethod>(
    () => methodFromCaptureParam(captureParam) ?? "manual",
  );
  const [seenCaptureParam, setSeenCaptureParam] = useState<string | null>(null);
  if (captureParam !== seenCaptureParam) {
    setSeenCaptureParam(captureParam);
    const nextMethod = methodFromCaptureParam(captureParam);
    if (nextMethod) {
      setMethod(nextMethod);
    }
    const intent = typeFromCaptureParam(captureParam);
    if (intent) {
      workspace.setTransactionForm((current) => ({
        ...current,
        type: intent,
        occurredOn: todayIso(),
        categoryId: categoryMatchesType(
          workspace.categories.find((category) => category.id === current.categoryId) ?? {
            id: "",
            kind: "expense",
          },
          intent,
        )
          ? current.categoryId
          : "",
      }));
    }
  }

  return (
    <TransactionsWorkspaceFrame
      title="Capture"
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
    >
      <div className="grid gap-4">
        <div
          role="tablist"
          aria-label="Capture method"
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted/30 p-0.5"
        >
          {methods.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={method === entry.id}
              onClick={() => setMethod(entry.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                method === entry.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {method === "manual" ? (
          <TransactionForm
            bare
            accounts={workspace.accounts}
            categories={workspace.categories}
            categoryUsage={workspace.categoryUsage}
            onCreateCategory={(name, kind) => void workspace.createCategory(name, kind)}
            counterparties={workspace.counterparties}
            transactions={workspace.transactions}
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
        ) : (
          <TextCapturePanel
            accounts={workspace.accounts}
            categories={workspace.categories}
            existingTransactions={workspace.transactions}
            isSubmitting={workspace.isSubmitting}
            initialInput={workspace.sharedCaptureInput}
            onSaveCaptured={workspace.saveCapturedTransactions}
          />
        )}
      </div>
    </TransactionsWorkspaceFrame>
  );
}
