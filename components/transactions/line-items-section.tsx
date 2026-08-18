"use client";

import { useState } from "react";
import { IconPencil, IconPlus, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/currency";
import {
  lineItemAmount,
  resolveLineItemDraft,
  summarizeItemization,
  type LineItemField,
} from "@/lib/domain/line-items";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Transaction, TransactionLineItem } from "@/lib/types";

import { DetailSection } from "./detail-row";

const emptyDraft = { label: "", quantity: "1", unitPrice: "", amount: "" };

function noteEdit(order: LineItemField[], field: LineItemField): LineItemField[] {
  return [field, ...order.filter((entry) => entry !== field)];
}

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
  const [editOrder, setEditOrder] = useState<LineItemField[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const summary = summarizeItemization(transaction.amount, lineItems);

  const resolved = resolveLineItemDraft(
    {
      quantity: parseAmountInput(draft.quantity) ?? undefined,
      unitPrice: parseAmountInput(draft.unitPrice) ?? undefined,
      amount: parseAmountInput(draft.amount) ?? undefined,
    },
    editOrder,
  );

  const setField = (field: LineItemField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setEditOrder((current) => noteEdit(current, field));
  };

  const shownValue = (field: LineItemField) =>
    resolved.derived === field && resolved[field] != null
      ? String(Math.round(resolved[field]! * 100) / 100)
      : draft[field];

  const closeForm = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setEditOrder([]);
    setIsFormOpen(false);
  };

  const beginEdit = (line: TransactionLineItem) => {
    setEditingId(line.id);
    setDraft({
      label: line.label,
      quantity: line.quantity != null ? String(line.quantity) : "1",
      unitPrice: line.unitPrice != null ? String(line.unitPrice) : "",
      amount: line.amount != null ? String(line.amount) : "",
    });
    setEditOrder(
      line.amount != null ? ["amount", "quantity"] : ["unitPrice", "quantity"],
    );
    setIsFormOpen(true);
  };

  const submitDraft = () => {
    if (!draft.label.trim()) return;
    onSave({
      id: editingId ?? undefined,
      transactionId: transaction.id,
      label: draft.label,
      quantity: resolved.quantity,
      unitPrice: resolved.unitPrice,
      amount: resolved.amount,
    });
    closeForm();
  };

  return (
    <DetailSection title="Items">
      {lineItems.length > 0 ? (
        <ul className="divide-y divide-border/40">
          {lineItems.map((line) => {
            const amount = lineItemAmount(line);
            return (
              <li key={line.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {line.label}
                  {line.quantity != null && line.quantity !== 1 ? (
                    <span className="text-muted-foreground"> × {line.quantity}</span>
                  ) : null}
                </span>
                {amount != null ? (
                  <Money amount={amount} tone="neutral" className="shrink-0 tabular-nums" />
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">no amount</span>
                )}
                <button
                  type="button"
                  aria-label={`Edit ${line.label}`}
                  disabled={isSubmitting}
                  onClick={() => beginEdit(line)}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                >
                  <IconPencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${line.label}`}
                  disabled={isSubmitting}
                  onClick={() => onDelete(line)}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                >
                  <IconX className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing itemized yet.</p>
      )}

      <p className="text-xs text-muted-foreground">
        {summary.overItemizedBy > 0 ? (
          <span className="font-medium text-destructive">
            Items exceed the transaction by {formatMoney(summary.overItemizedBy)}.
          </span>
        ) : summary.unitemized > 0 ? (
          <>
            <span className="font-medium text-foreground">
              {formatMoney(summary.unitemized)}
            </span>{" "}
            still to itemize, of {formatMoney(transaction.amount)}.
          </>
        ) : (
          <span className="font-medium text-foreground">Fully itemized.</span>
        )}
      </p>

      {isFormOpen ? (
        <div className="grid gap-2 rounded-lg border border-border/40 p-3">
          <div className="grid gap-1">
            <Label htmlFor="line-item-label">Item</Label>
            <Input
              id="line-item-label"
              value={draft.label}
              placeholder="Sugar (1kg)"
              autoFocus
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <NumberField
              id="line-item-quantity"
              label="Qty"
              value={shownValue("quantity")}
              derived={resolved.derived === "quantity"}
              onChange={(value) => setField("quantity", value)}
            />
            <NumberField
              id="line-item-unit-price"
              label="Unit price"
              value={shownValue("unitPrice")}
              derived={resolved.derived === "unitPrice"}
              onChange={(value) => setField("unitPrice", value)}
            />
            <NumberField
              id="line-item-amount"
              label="Amount"
              value={shownValue("amount")}
              derived={resolved.derived === "amount"}
              onChange={(value) => setField("amount", value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isSubmitting || !draft.label.trim()}
              onClick={submitDraft}
            >
              {editingId ? "Save item" : "Add item"}
            </Button>
            <Button size="sm" variant="ghost" disabled={isSubmitting} onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="justify-self-start"
          disabled={isSubmitting}
          onClick={() => setIsFormOpen(true)}
        >
          <IconPlus className="size-4" />
          Add item
        </Button>
      )}
    </DetailSection>
  );
}

function NumberField({
  id,
  label,
  value,
  derived,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  derived: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="flex items-baseline gap-1">
        {label}
        {derived ? (
          <span className="text-[10px] font-normal text-muted-foreground">calculated</span>
        ) : null}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        className={derived ? "text-muted-foreground" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
