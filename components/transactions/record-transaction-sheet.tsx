"use client";

import { useState, type ReactNode } from "react";

import type { TransactionFormState } from "@/components/transactions/transaction-form";
import { todayIso } from "@/lib/today";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { useTransactionsWorkspace } from "@/components/transactions/use-transactions-workspace";

export function RecordTransactionSheet({
  open,
  onOpenChange,
  onRecorded,
  initialForm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded?: () => void;
  initialForm?: Partial<TransactionFormState>;
}) {
  const workspace = useTransactionsWorkspace();

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      workspace.setTransactionForm((current) => ({
        ...current,
        occurredOn: todayIso(),
        ...initialForm,
      }));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92vh] flex-col gap-0 px-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-lg"
      >
        <SheetHeader className="px-5 pb-2">
          <SheetTitle>Record a transaction</SheetTitle>
          <SheetDescription className="sr-only">
            Add money in, money out, or a transfer without leaving this page.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
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
            onSubmit={(event) => {
              void (async () => {
                await workspace.handleTransactionSubmit(event);
                onOpenChange(false);
                onRecorded?.();
              })();
            }}
            onCancelEdit={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function useRecordTransaction(onRecorded?: () => void) {
  const [open, setOpen] = useState(false);
  const [initialForm, setInitialForm] = useState<Partial<TransactionFormState> | undefined>();

  const sheet: ReactNode = (
    <RecordTransactionSheet
      open={open}
      onOpenChange={setOpen}
      onRecorded={onRecorded}
      initialForm={initialForm}
    />
  );

  return {
    open: (prefill?: Partial<TransactionFormState>) => {
      setInitialForm(prefill);
      setOpen(true);
    },
    sheet,
  };
}
