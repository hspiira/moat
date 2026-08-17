"use client";

import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format-date";
import { getTransactionDetail } from "@/lib/domain/transaction-detail";
import { transferLegs } from "@/lib/domain/transaction-cascade";
import { transactionTypeLabels } from "@/lib/select-options";
import type { Account, Category, Transaction, TransactionLineItem } from "@/lib/types";

import { DetailNote, DetailRow, DetailSection } from "./detail-row";
import { LineItemsSection } from "./line-items-section";

const outflowTypes = new Set(["expense", "debt_payment"]);

const reconciliationLabels: Record<Transaction["reconciliationState"], string> = {
  draft: "Draft",
  parsed: "Parsed",
  reviewed: "Reviewed",
  posted: "Posted",
  matched: "Matched",
};

const sourceLabels: Record<Transaction["source"], string> = {
  manual: "Entered by hand",
  csv: "CSV import",
  notification: "Notification",
  sms: "SMS",
};

/**
 * Read-only view of one transaction and the fee charged against it. Asking for
 * a fee row shows its parent instead: a fee on its own says nothing about what
 * was actually bought.
 */
export function TransactionDetailSheet({
  transaction,
  transactions,
  accounts,
  categories,
  lineItems,
  isSubmitting,
  onOpenChange,
  onSaveLineItem,
  onDeleteLineItem,
}: {
  transaction: Transaction | null;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  lineItems?: TransactionLineItem[];
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveLineItem?: (input: {
    id?: string;
    transactionId: string;
    label: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }) => void;
  onDeleteLineItem?: (lineItem: TransactionLineItem) => void;
}) {
  const detail = transaction ? getTransactionDetail(transaction, transactions) : null;
  const subject = detail?.subject ?? null;

  const account = subject ? accounts.find((entry) => entry.id === subject.accountId) : undefined;
  const category = subject ? categories.find((entry) => entry.id === subject.categoryId) : undefined;
  const isOutflow = subject ? outflowTypes.has(subject.type) : false;

  // A transfer showed only the leg you tapped, so the sheet never said where
  // the money actually went.
  const legs = subject?.type === "transfer" ? transferLegs(subject, transactions) : null;
  const accountName = (id: string) => accounts.find((entry) => entry.id === id)?.name;
  const accountLabel = legs
    ? `${accountName(legs.source.accountId) ?? "Unknown"} → ${accountName(legs.destination.accountId) ?? "Unknown"}`
    : (account?.name ?? "Unknown account");
  const title = subject
    ? (subject.payee ?? subject.rawPayee ?? category?.name ?? transactionTypeLabels[subject.type])
    : "";

  return (
    <Sheet open={Boolean(transaction)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="gap-1">
          <SheetTitle className="pr-8 text-base">{title}</SheetTitle>
          <SheetDescription>Transaction details</SheetDescription>
        </SheetHeader>

        {subject && detail ? (
          <div className="grid gap-4">
            <div className="grid gap-1">
              <Money
                amount={subject.amount}
                currency="UGX"
                tone={isOutflow ? "negative" : "positive"}
                signed
                className="text-xl"
              />
              <div className="text-sm text-muted-foreground">
                {[
                  transactionTypeLabels[subject.type],
                  formatDate(subject.occurredOn, { alwaysYear: true }),
                  accountLabel,
                  category?.name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {detail.parent ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  You opened a fee. Showing the payment it was charged against.
                </p>
              ) : null}
            </div>

            {detail.fee || subject.currency !== "UGX" || typeof subject.statedBalance === "number" ? (
              <DetailSection>
                {subject.currency !== "UGX" ? (
                  <>
                    <DetailRow label={`Original (${subject.currency})`}>
                      <Money amount={subject.originalAmount} currency={subject.currency} />
                    </DetailRow>
                    <DetailRow label="Exchange rate">
                      {subject.fxRateToUgx
                        ? `1 ${subject.currency} = ${subject.fxRateToUgx} UGX`
                        : "—"}
                    </DetailRow>
                  </>
                ) : null}
                {detail.fee ? (
                  <>
                    <DetailRow label={detail.fee.note ?? "Fee / charges"}>
                      <Money amount={detail.fee.amount} currency="UGX" tone="negative" signed />
                    </DetailRow>
                    <DetailRow label="Total off account" className="border-t border-border/50 pt-2">
                      <Money
                        amount={detail.totalOffAccount}
                        currency="UGX"
                        tone={isOutflow ? "negative" : "positive"}
                        signed
                        className="font-medium"
                      />
                    </DetailRow>
                  </>
                ) : null}
                {typeof subject.statedBalance === "number" ? (
                  <DetailRow label="Balance stated by sender">
                    <Money amount={subject.statedBalance} currency="UGX" />
                  </DetailRow>
                ) : null}
              </DetailSection>
            ) : null}

            {subject.note ? <DetailNote label="Note">{subject.note}</DetailNote> : null}

            <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
              <span>{reconciliationLabels[subject.reconciliationState]}</span>
              <span aria-hidden>·</span>
              <span>{sourceLabels[subject.source]}</span>
              {subject.parserLabel ? <Badge variant="outline">{subject.parserLabel}</Badge> : null}
              {typeof subject.confidenceScore === "number" ? (
                <Badge variant="secondary">{Math.round(subject.confidenceScore * 100)}%</Badge>
              ) : null}
              {subject.matchedRuleId ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Rule applied</span>
                </>
              ) : null}
              {subject.isRecurringCandidate ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Looks recurring</span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span>Recorded {formatDate(subject.createdAt, { alwaysYear: true })}</span>
            </p>

            {subject && subject.type === "expense" && onSaveLineItem && onDeleteLineItem ? (
              <LineItemsSection
                transaction={subject}
                lineItems={(lineItems ?? []).filter((line) => line.transactionId === subject.id)}
                isSubmitting={isSubmitting ?? false}
                onSave={onSaveLineItem}
                onDelete={onDeleteLineItem}
              />
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
