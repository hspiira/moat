"use client";

import { useMemo, useState } from "react";

import { formatMoney, normalizeAmountToUgx } from "@/lib/currency";
import type {
  Account,
  Category,
  Counterparty,
  SupportedCurrency,
  TransactionType,
} from "@/lib/types";
import {
  NEW_COUNTERPARTY,
  counterpartyOptionsFor,
  describeTransferCounterparty,
} from "@/lib/domain/transfer-counterparty";
import { transactionTypeForCategory } from "@/lib/domain/transaction-classification";
import { DatePickerField } from "@/components/forms/date-picker-field";
import { FormCardShell } from "@/components/forms/form-card-shell";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { CategoryField } from "@/components/transactions/category-field";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import {
  accountOptions,
  optionsFromRecord,
  supportedCurrencyOptionLabels,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";

export { transactionTypeLabels } from "@/lib/select-options";

export type TransactionFormState = {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  currency: SupportedCurrency;
  payee: string;
  /** The person on a loan. NEW_COUNTERPARTY means "use counterpartyName". */
  counterpartyId: string;
  counterpartyName: string;
  amount: string;
  fxRateToUgx: string;
  feeAmount: string;
  occurredOn: string;
  /** Lending only: the date the borrower agreed to repay by. Never inferred. */
  expectedRepaymentDate: string;
  note: string;
};

export const defaultTransactionForm: TransactionFormState = {
  type: "expense",
  accountId: "",
  destinationAccountId: "",
  categoryId: "",
  currency: "UGX",
  payee: "",
  counterpartyId: "",
  counterpartyName: "",
  amount: "",
  fxRateToUgx: "",
  feeAmount: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  expectedRepaymentDate: "",
  note: "",
};

// Re-exported for the modules that already import it from here. The rule
type Props = {
  accounts: Account[];
  categories: Category[];
  counterparties: Counterparty[];
  form: TransactionFormState;
  editingId: string | null;
  isSubmitting: boolean;
  lastSavedAt: string | null;
  successMessage: string | null;
  rememberedFxHint?: string | null;
  onFormChange: (updater: (prev: TransactionFormState) => TransactionFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  /** When true, render just the form for use inside a sheet (no card chrome). */
  embedded?: boolean;
  /** When true, render with no chrome at all — the page header carries the context. */
  bare?: boolean;
};

export function TransactionForm({
  accounts,
  categories,
  counterparties,
  form,
  editingId,
  isSubmitting,
  lastSavedAt,
  successMessage,
  rememberedFxHint,
  onFormChange,
  onSubmit,
  onCancelEdit,
  embedded,
  bare,
}: Props) {
  const normalizedUgxAmount = useMemo(
    () =>
      normalizeAmountToUgx(Number(form.amount), form.currency, Number(form.fxRateToUgx || 0)),
    [form.amount, form.currency, form.fxRateToUgx],
  );
  const showFxFields = form.currency !== "UGX";
  const hasValidNormalizedAmount = Number.isFinite(normalizedUgxAmount) && normalizedUgxAmount > 0;
  const counterparty = useMemo(
    () =>
      form.type === "transfer"
        ? describeTransferCounterparty(accounts, form.accountId, form.destinationAccountId)
        : null,
    [accounts, form.accountId, form.destinationAccountId, form.type],
  );

  // Payee, note, and currency are the rare fields; they stay collapsed until
  // asked for. Auto-expand (render-time adjust, never auto-collapse) when a
  // deep link or an edit populates one of them.
  const hasDetails = Boolean(
    form.payee || form.note || form.currency !== "UGX" || form.feeAmount,
  );
  const supportsFee = form.type === "expense" || form.type === "transfer";
  const [detailsOpen, setDetailsOpen] = useState(hasDetails);
  const [seenHasDetails, setSeenHasDetails] = useState(hasDetails);
  if (hasDetails !== seenHasDetails) {
    setSeenHasDetails(hasDetails);
    if (hasDetails) setDetailsOpen(true);
  }

  const content = (
    <form className="grid gap-4" onSubmit={onSubmit}>
          <InputField
            id="tx-amount"
            label={`Amount (${form.currency})`}
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => onFormChange((c) => ({ ...c, amount: e.target.value }))}
            required
          />

          {showFxFields ? (
            <>
              <InputField
                id="tx-fx-rate"
                label="Exchange rate to UGX"
                inputMode="decimal"
                value={form.fxRateToUgx}
                onChange={(e) =>
                  onFormChange((current) => ({ ...current, fxRateToUgx: e.target.value }))
                }
                placeholder="e.g. 3700"
                required={showFxFields}
              />
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {hasValidNormalizedAmount ? (
                  <>
                    Saved as{" "}
                    <span className="text-foreground">
                      {formatMoney(normalizedUgxAmount, "UGX")}
                    </span>
                    {" "}from {formatMoney(Number(form.amount || 0), form.currency)}.
                  </>
                ) : (
                  "Enter a valid exchange rate to save this in UGX."
                )}
                {rememberedFxHint ? (
                  <div className="mt-1 text-[11px] text-foreground/72">{rememberedFxHint}</div>
                ) : null}
              </div>
            </>
          ) : null}

          {/* Category comes first now: it decides the transaction type, and
              therefore which of the fields below are even relevant. */}
          <CategoryField
            categories={categories}
            value={form.categoryId}
            type={form.type}
            onSelect={(picked) =>
              onFormChange((c) => ({
                ...c,
                categoryId: picked.id,
                // The category decides the type. There is no separate type
                // field left to disagree with it, so the pair is coherent by
                // construction rather than by validation.
                type: transactionTypeForCategory(picked),
              }))
            }
          />

          <div className="grid gap-2">
            <SelectField
              id="tx-account"
              label={
                form.type === "transfer" || form.type === "debt_payment"
                  ? "From account"
                  : "Account"
              }
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

          {form.type === "debt_payment" ? (
            <div className="grid gap-2">
              <SelectField
                id="tx-loan"
                label="Which loan"
                value={form.destinationAccountId}
                placeholder="Select loan"
                options={accountOptions(accounts.filter((a) => a.type === "debt"))}
                onValueChange={(v) => onFormChange((c) => ({ ...c, destinationAccountId: v }))}
              />
              <p className="text-xs text-muted-foreground">
                Interest and principal are separated automatically from the loan&apos;s rate.
              </p>
            </div>
          ) : null}

          {counterparty ? (
            <>
              {counterparty.requiresPayee ? (
                <>
                  <SelectField
                    id="tx-counterparty"
                    label={counterparty.label}
                    value={form.counterpartyId}
                    placeholder="Select or add a person"
                    options={counterpartyOptionsFor(counterparties, counterparty.direction)}
                    onValueChange={(value) =>
                      onFormChange((c) => ({ ...c, counterpartyId: value }))
                    }
                  />
                  {form.counterpartyId === NEW_COUNTERPARTY ? (
                    <InputField
                      id="tx-counterparty-name"
                      label="Their name"
                      value={form.counterpartyName}
                      onChange={(e) =>
                        onFormChange((c) => ({ ...c, counterpartyName: e.target.value }))
                      }
                      placeholder={counterparty.placeholder}
                      hint="Added to your people, so next time you pick them from the list."
                    />
                  ) : null}
                </>
              ) : null}
              {counterparty.showExpectedDate ? (
                <DatePickerField
                  id="tx-expected-repayment"
                  label={
                    counterparty.direction === "borrow"
                      ? "Agreed to repay by (optional)"
                      : "Expected back by (optional)"
                  }
                  value={form.expectedRepaymentDate}
                  onChange={(value) =>
                    onFormChange((c) => ({ ...c, expectedRepaymentDate: value }))
                  }
                  hint="Only what you agreed. Moat never guesses a repayment date."
                />
              ) : null}
            </>
          ) : null}

          <DatePickerField
            id="tx-date"
            label="Date"
            value={form.occurredOn}
            onChange={(v) => onFormChange((c) => ({ ...c, occurredOn: v }))}
          />

          {detailsOpen ? (
            <div className="grid gap-4 pt-4">
              <InputField
                id="tx-payee"
                label="Payee / source"
                value={form.payee}
                onChange={(e) => onFormChange((c) => ({ ...c, payee: e.target.value }))}
                placeholder="Optional"
              />

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

              {supportsFee ? (
                <InputField
                  id="tx-fee"
                  label="Fee — charges & tax (UGX)"
                  inputMode="decimal"
                  value={form.feeAmount}
                  onChange={(e) => onFormChange((c) => ({ ...c, feeAmount: e.target.value }))}
                  placeholder="Optional — e.g. 1250"
                />
              ) : null}

              <TextareaField
                id="tx-note"
                label="Note"
                value={form.note}
                onChange={(e) => onFormChange((c) => ({ ...c, note: e.target.value }))}
                placeholder="Optional"
                className="min-h-16"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="w-fit text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {supportsFee
                ? "Add details — fee, payee, note, currency"
                : "Add details — payee, note, currency"}
            </button>
          )}

          {isSubmitting || successMessage ? (
            <LocalSaveFeedback
              isSubmitting={isSubmitting}
              lastSavedAt={lastSavedAt}
              successMessage={successMessage}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button disabled={isSubmitting} type="submit" size="lg" className="w-full sm:w-auto">
              {isSubmitting ? "Saving..." : editingId ? "Update" : "Add transaction"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={onCancelEdit}
              >
                Cancel
              </Button>
            ) : null}
          </div>
    </form>
  );

  const title = editingId ? "Edit transaction" : "Add transaction";
  const description = editingId
    ? "Update this transaction."
    : "Record one money event against one account.";

  return (
    <FormCardShell embedded={embedded} plain={bare} title={title} description={description}>
      {content}
    </FormCardShell>
  );
}
