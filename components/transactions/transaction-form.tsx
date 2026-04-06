"use client";

import { useMemo } from "react";

import { formatMoney, normalizeAmountToUgx } from "@/lib/currency";
import type { Account, Category, SupportedCurrency, TransactionType } from "@/lib/types";
import { AccentCardHeader } from "@/components/accent-card-header";
import { SelectField } from "@/components/forms/select-field";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import {
  accountOptions,
  categoryOptions,
  optionsFromRecord,
  supportedCurrencyOptionLabels,
  transactionTypeLabels,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export { transactionTypeLabels } from "@/lib/select-options";

export type TransactionFormState = {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  currency: SupportedCurrency;
  payee: string;
  amount: string;
  fxRateToUgx: string;
  occurredOn: string;
  note: string;
};

export const defaultTransactionForm: TransactionFormState = {
  type: "expense",
  accountId: "",
  destinationAccountId: "",
  categoryId: "",
  currency: "UGX",
  payee: "",
  amount: "",
  fxRateToUgx: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  note: "",
};

export function categoryMatchesType(category: Category, type: TransactionType) {
  if (type === "income") return category.kind === "income";
  if (type === "transfer") return category.kind === "transfer";
  if (type === "savings_contribution") return category.kind === "savings";
  return category.kind === "expense";
}

type Props = {
  accounts: Account[];
  categories: Category[];
  form: TransactionFormState;
  editingId: string | null;
  isSubmitting: boolean;
  lastSavedAt: string | null;
  successMessage: string | null;
  onFormChange: (updater: (prev: TransactionFormState) => TransactionFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
};

export function TransactionForm({
  accounts,
  categories,
  form,
  editingId,
  isSubmitting,
  lastSavedAt,
  successMessage,
  onFormChange,
  onSubmit,
  onCancelEdit,
}: Props) {
  const availableCategories = categories.filter((c) => categoryMatchesType(c, form.type));
  const normalizedUgxAmount = useMemo(
    () =>
      normalizeAmountToUgx(Number(form.amount), form.currency, Number(form.fxRateToUgx || 0)),
    [form.amount, form.currency, form.fxRateToUgx],
  );
  const showFxFields = form.currency !== "UGX";
  const hasValidNormalizedAmount = Number.isFinite(normalizedUgxAmount) && normalizedUgxAmount > 0;

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="yellow"
        title={editingId ? "Edit transaction" : "Add transaction"}
        description={
          editingId
            ? "Update this transaction."
            : "Record one money event against one account."
        }
      />
      <CardContent className="p-5">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <LocalSaveFeedback
            isSubmitting={isSubmitting}
            lastSavedAt={lastSavedAt}
            successMessage={successMessage}
          />

          <div className="grid gap-2">
            <SelectField
              id="tx-type"
              label="Type"
              value={form.type}
              options={optionsFromRecord(transactionTypeLabels)}
              onValueChange={(v) => {
                const nextType = v as TransactionType;
                onFormChange((c) => ({
                  ...c,
                  type: nextType,
                  categoryId:
                    categories.find((cat) => categoryMatchesType(cat, nextType))?.id ?? "",
                }));
              }}
            />
          </div>

          <div className="grid gap-2">
            <SelectField
              id="tx-account"
              label={form.type === "transfer" ? "From account" : "Account"}
              value={form.accountId}
              placeholder="Select account"
              options={accountOptions(accounts)}
              onValueChange={(v) => onFormChange((c) => ({ ...c, accountId: v }))}
            />
          </div>

          {form.type === "transfer" ? (
            <div className="grid gap-2">
              <SelectField
                id="tx-dest"
                label="To account"
                value={form.destinationAccountId}
                placeholder="Select destination"
                options={accountOptions(accounts)}
                onValueChange={(v) => onFormChange((c) => ({ ...c, destinationAccountId: v }))}
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <SelectField
              id="tx-category"
              label="Category"
              value={form.categoryId}
              placeholder="Select category"
              options={categoryOptions(availableCategories)}
              onValueChange={(v) => onFormChange((c) => ({ ...c, categoryId: v }))}
            />
          </div>

          <div className="grid gap-2">
            <SelectField
              id="tx-currency"
              label="Currency"
              value={form.currency}
              options={optionsFromRecord(supportedCurrencyOptionLabels)}
              onValueChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  currency: value as SupportedCurrency,
                  fxRateToUgx: value === "UGX" ? "" : current.fxRateToUgx,
                }))
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-payee">Payee / source</Label>
            <Input
              id="tx-payee"
              value={form.payee}
              onChange={(e) => onFormChange((c) => ({ ...c, payee: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-amount">
              Amount ({form.currency})
            </Label>
            <Input
              id="tx-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => onFormChange((c) => ({ ...c, amount: e.target.value }))}
              required
            />
          </div>

          {showFxFields ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="tx-fx-rate">FX rate to UGX</Label>
                <Input
                  id="tx-fx-rate"
                  inputMode="decimal"
                  value={form.fxRateToUgx}
                  onChange={(e) =>
                    onFormChange((current) => ({ ...current, fxRateToUgx: e.target.value }))
                  }
                  placeholder="e.g. 3700"
                  required={showFxFields}
                />
              </div>
              <div className="border border-border/20 px-3 py-2 text-xs text-muted-foreground">
                {hasValidNormalizedAmount ? (
                  <>
                    Posts to books as{" "}
                    <span className="text-foreground">
                      {formatMoney(normalizedUgxAmount, "UGX")}
                    </span>
                    {" "}from {formatMoney(Number(form.amount || 0), form.currency)}.
                  </>
                ) : (
                  "Enter a valid FX rate to post the transaction in UGX."
                )}
              </div>
            </>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="tx-date">Date</Label>
            <DatePicker
              id="tx-date"
              value={form.occurredOn}
              onChange={(v) => onFormChange((c) => ({ ...c, occurredOn: v }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-note">Note</Label>
            <Textarea
              id="tx-note"
              value={form.note}
              onChange={(e) => onFormChange((c) => ({ ...c, note: e.target.value }))}
              placeholder="Optional"
              className="min-h-16"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={isSubmitting} type="submit" size="sm">
              {isSubmitting ? "Saving..." : editingId ? "Update" : "Add transaction"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
