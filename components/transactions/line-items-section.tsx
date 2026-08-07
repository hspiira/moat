"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/currency";
import { lineItemAmount, summarizeItemization } from "@/lib/domain/line-items";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Transaction, TransactionLineItem } from "@/lib/types";

import { DetailSection } from "./detail-row";

const emptyDraft = { label: "", quantity: "", unitPrice: "", amount: "" };

/**
 * Informal itemization of one expense: lines may cover part or all of the
 * amount, and the summary line reports the gap instead of blocking entry.
 */
export function LineItemsSection({
  transaction,
  lineItems,
  isSubmitting,
  onSave,
  onDelete,
}: {
  transaction: Transaction;
  lineItems: TransactionLineItem[];
  isSubmitting: boolean;
  onSave: (input: {
    id?: string;
    transactionId: string;
    label: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }) => void;
  onDelete: (lineItem: TransactionLineItem) => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const summary = summarizeItemization(transaction.amount, lineItems);

  const beginEdit = (line: TransactionLineItem) => {
    setEditingId(line.id);
    setDraft({
      label: line.label,
      quantity: line.quantity != null ? String(line.quantity) : "",
      unitPrice: line.unitPrice != null ? String(line.unitPrice) : "",
      amount: line.amount != null ? String(line.amount) : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const submitDraft = () => {
    if (!draft.label.trim()) return;
    onSave({
      id: editingId ?? undefined,
      transactionId: transaction.id,
      label: draft.label,
      quantity: parseAmountInput(draft.quantity) ?? undefined,
      unitPrice: parseAmountInput(draft.unitPrice) ?? undefined,
      amount: parseAmountInput(draft.amount) ?? undefined,
    });
    setEditingId(null);
    setDraft(emptyDraft);
  };

  return (
    <DetailSection title="Items">
      {lineItems.length > 0 ? (
        <ul className="grid gap-2">
          {lineItems.map((line) => {
            const amount = lineItemAmount(line);
            return (
              <li key={line.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {line.label}
                  {line.quantity != null ? (
                    <span className="text-muted-foreground"> × {line.quantity}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {amount != null ? (
                    <Money amount={amount} tone="neutral" />
                  ) : (
                    <span className="text-xs text-muted-foreground">no amount</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                    onClick={() => beginEdit(line)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSubmitting}
                    onClick={() => onDelete(line)}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No items recorded for this transaction yet.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {summary.overItemizedBy > 0
          ? `Items exceed the transaction by ${formatMoney(summary.overItemizedBy)}.`
          : `Itemized ${formatMoney(summary.itemizedTotal)} of ${formatMoney(transaction.amount)} — ${formatMoney(summary.unitemized)} unitemized.`}
      </p>

      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor="line-item-label">Item</Label>
          <Input
            id="line-item-label"
            value={draft.label}
            placeholder="Sugar (1kg)"
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="line-item-quantity">Qty</Label>
          <Input
            id="line-item-quantity"
            inputMode="numeric"
            value={draft.quantity}
            onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="line-item-unit-price">Unit price</Label>
          <Input
            id="line-item-unit-price"
            inputMode="numeric"
            value={draft.unitPrice}
            onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="line-item-amount">Amount</Label>
          <Input
            id="line-item-amount"
            inputMode="numeric"
            value={draft.amount}
            onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isSubmitting || !draft.label.trim()}
            onClick={submitDraft}
          >
            {editingId ? "Save" : "Add item"}
          </Button>
          {editingId ? (
            <Button size="sm" variant="ghost" disabled={isSubmitting} onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </DetailSection>
  );
}
