"use client";

import { useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { useTransactionsWorkspace } from "@/components/transactions/use-transactions-workspace";

/**
 * Records a transaction without leaving the page that asked for one.
 *
 * A screen that says "no spending recorded yet" and then navigates you to
 * Transactions has answered a different question than the one you asked: you
 * wanted the number filled in, not a change of address. The form comes to you,
 * and the page you were reading is still behind it when you are done.
 */
export function RecordTransactionSheet({
  open,
  onOpenChange,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded?: () => void;
}) {
  const workspace = useTransactionsWorkspace();

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
            counterparties={workspace.counterparties}
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

/**
 * Wraps a trigger so any empty state or prompt can host the sheet with one
 * piece of state instead of each caller inventing its own.
 */
export function useRecordTransaction(onRecorded?: () => void) {
  const [open, setOpen] = useState(false);

  const sheet: ReactNode = (
    <RecordTransactionSheet open={open} onOpenChange={setOpen} onRecorded={onRecorded} />
  );

  return { open: () => setOpen(true), sheet };
}
