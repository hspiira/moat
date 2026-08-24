"use client";

import { AmountIndicator } from "@/components/amount-indicator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import type { PartyLedgerEntry, PartyPortfolio } from "@/lib/domain/party-ledger";

export type PartyBandCopy = {
  title: string;
  description: string;
  settledMessage: string;
  advancedLabel: string;
  cancelledLabel: string;
  dueLabel: (when: string) => string;
  overdueLabel: (when: string) => string;
  lastRepaymentLabel: (when: string) => string;
  advancedOnLabel: (when: string) => string;
};

function caption(party: PartyLedgerEntry, copy: PartyBandCopy): string {
  if (party.expectedRepaymentDate) {
    const when = formatDate(party.expectedRepaymentDate);
    return party.isOverdue ? copy.overdueLabel(when) : copy.dueLabel(when);
  }
  if (party.lastRepaymentOn) {
    return copy.lastRepaymentLabel(formatDate(party.lastRepaymentOn));
  }
  if (party.advancedOn) {
    return copy.advancedOnLabel(formatDate(party.advancedOn));
  }
  return "No activity yet";
}

function PartyRow({ party, copy }: { party: PartyLedgerEntry; copy: PartyBandCopy }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="grid gap-0.5">
        <span className="font-medium text-foreground">{party.partyName}</span>
        <span
          className={
            party.isOverdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {party.isOverdue ? "⚠ " : ""}
          {caption(party, copy)}
        </span>
      </div>
      <AmountIndicator
        tone={party.outstanding > 0 ? "negative" : "neutral"}
        sign="none"
        value={formatMoney(party.outstanding, "UGX")}
        className="text-sm font-medium"
      />
    </div>
  );
}

function Tile({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">
        {formatMoney(amount, "UGX")}
      </span>
    </div>
  );
}

export function PartyBand({
  portfolio,
  copy,
}: {
  portfolio: PartyPortfolio;
  copy: PartyBandCopy;
}) {
  if (portfolio.parties.length === 0) {
    return null;
  }

  const unsettled = portfolio.parties.filter(
    (party) => party.status === "outstanding" || party.status === "overpaid",
  );

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Still owed" amount={portfolio.totalOutstanding} />
          <Tile label={copy.advancedLabel} amount={portfolio.totalAdvanced} />
          <Tile label="Repaid" amount={portfolio.totalRepaid} />
          <Tile label={copy.cancelledLabel} amount={portfolio.totalCancelled} />
        </div>

        <div className="grid">
          {unsettled.length > 0 ? (
            unsettled.map((party) => (
              <PartyRow key={party.partyKey} party={party} copy={copy} />
            ))
          ) : (
            <p className="py-3 text-sm text-muted-foreground">{copy.settledMessage}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const LENDING_BAND_COPY: PartyBandCopy = {
  title: "Owed to you",
  description:
    "Money you have lent out. Lending does not count as spending, and it does not change your net worth, the cash simply moved.",
  settledMessage: "Everyone has settled up.",
  advancedLabel: "Lent",
  cancelledLabel: "Written off",
  dueLabel: (when) => `Expected back ${when}`,
  overdueLabel: (when) => `Overdue since ${when}`,
  lastRepaymentLabel: (when) => `Last repayment ${when}`,
  advancedOnLabel: (when) => `Lent ${when}`,
};

export const BORROWING_BAND_COPY: PartyBandCopy = {
  title: "You owe",
  description:
    "Money borrowed from people rather than institutions. There is no interest and no schedule here, Moat only shows a date when you have agreed to one.",
  settledMessage: "You have settled up with everyone.",
  advancedLabel: "Borrowed",
  cancelledLabel: "Forgiven",
  dueLabel: (when) => `Agreed to repay by ${when}`,
  overdueLabel: (when) => `Overdue since ${when}`,
  lastRepaymentLabel: (when) => `Last payment ${when}`,
  advancedOnLabel: (when) => `Borrowed ${when}`,
};
