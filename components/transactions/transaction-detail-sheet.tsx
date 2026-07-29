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
import { transactionTypeLabels } from "@/lib/select-options";
import type { Account, Category, Transaction } from "@/lib/types";

import { DetailRow, DetailSection } from "./detail-row";

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
  onOpenChange,
}: {
  transaction: Transaction | null;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onOpenChange: (open: boolean) => void;
}) {
  const detail = transaction ? getTransactionDetail(transaction, transactions) : null;
  const subject = detail?.subject ?? null;

  const account = subject ? accounts.find((entry) => entry.id === subject.accountId) : undefined;
  const category = subject ? categories.find((entry) => entry.id === subject.categoryId) : undefined;
  const isOutflow = subject ? outflowTypes.has(subject.type) : false;
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
          <div className="grid gap-5">
            <div className="grid gap-1">
              <Money
                amount={subject.amount}
                currency="UGX"
                tone={isOutflow ? "negative" : "positive"}
                signed
                className="text-2xl"
              />
              <div className="text-sm text-muted-foreground">
                {formatDate(subject.occurredOn, { alwaysYear: true })} ·{" "}
                {account?.name ?? "Unknown account"}
                {category ? ` · ${category.name}` : ""}
              </div>
              {detail.parent ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  You opened a fee. Showing the payment it was charged against.
                </p>
              ) : null}
            </div>

            {detail.fee ? (
              <DetailSection title="Charges">
                <DetailRow label={detail.fee.note ?? "Charges & tax"}>
                  <Money amount={detail.fee.amount} currency="UGX" tone="negative" signed />
                </DetailRow>
                <DetailRow label="Total off account" className="border-t border-border/30 pt-2">
                  <Money
                    amount={detail.totalOffAccount}
                    currency="UGX"
                    tone={isOutflow ? "negative" : "positive"}
                    signed
                    className="font-medium"
                  />
                </DetailRow>
              </DetailSection>
            ) : null}

            <DetailSection title="Record">
              <DetailRow label="Type">{transactionTypeLabels[subject.type]}</DetailRow>
              {subject.currency !== "UGX" ? (
                <>
                  <DetailRow label={`Original (${subject.currency})`}>
                    <Money amount={subject.originalAmount} currency={subject.currency} />
                  </DetailRow>
                  <DetailRow label="FX rate">
                    {subject.fxRateToUgx ? `1 ${subject.currency} = ${subject.fxRateToUgx} UGX` : "—"}
                  </DetailRow>
                </>
              ) : null}
              {subject.note ? <DetailRow label="Note">{subject.note}</DetailRow> : null}
              <DetailRow label="State">{reconciliationLabels[subject.reconciliationState]}</DetailRow>
              {typeof subject.statedBalance === "number" ? (
                <DetailRow label="Stated balance">
                  <Money amount={subject.statedBalance} currency="UGX" />
                </DetailRow>
              ) : null}
            </DetailSection>

            <DetailSection title="Origin">
              <DetailRow label="Source">
                <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                  {sourceLabels[subject.source]}
                  {subject.parserLabel ? (
                    <Badge variant="outline">{subject.parserLabel}</Badge>
                  ) : null}
                  {typeof subject.confidenceScore === "number" ? (
                    <Badge variant="secondary">
                      {Math.round(subject.confidenceScore * 100)}%
                    </Badge>
                  ) : null}
                </span>
              </DetailRow>
              {subject.matchedRuleId ? <DetailRow label="Matched rule">Applied</DetailRow> : null}
              {subject.isRecurringCandidate ? (
                <DetailRow label="Recurring">Looks recurring</DetailRow>
              ) : null}
              <DetailRow label="Recorded">
                {formatDate(subject.createdAt, { alwaysYear: true })}
              </DetailRow>
            </DetailSection>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
