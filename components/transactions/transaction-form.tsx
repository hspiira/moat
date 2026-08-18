"use client";

import { useMemo, useState } from "react";

import { formatMoney, normalizeAmountToUgx } from "@/lib/currency";
import type {
  Account,
  Category,
  CategoryKind,
  Counterparty,
  SupportedCurrency,
  Transaction,
  TransactionType,
} from "@/lib/types";
import {
  NEW_COUNTERPARTY,
  describeTransferCounterparty,
  type TransferDirection,
} from "@/lib/domain/transfer-counterparty";
import { getBorrowingPortfolio } from "@/lib/domain/borrowing";
import { getLendingPortfolio } from "@/lib/domain/lending";
import { previewLoanRepayment, previewPartyRepayment } from "@/lib/domain/repayment";
import { formatDate } from "@/lib/format-date";
import { transactionTypeForCategory } from "@/lib/domain/transaction-classification";
import { DatePickerField } from "@/components/forms/date-picker-field";
import { FormCardShell } from "@/components/forms/form-card-shell";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { CategoryField } from "@/components/transactions/category-field";
import { PersonField } from "@/components/transactions/person-field";
import { RepaymentSection, RepaymentSummary } from "@/components/transactions/repayment-section";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import {
  accountOptions,
  optionsFromRecord,
  supportedCurrencyOptionLabels,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/lib/today";

export { transactionTypeLabels } from "@/lib/select-options";

export type TransactionFormState = {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  currency: SupportedCurrency;
  payee: string;
  counterpartyId: string;
  counterpartyName: string;
  amount: string;
  fxRateToUgx: string;
  feeAmount: string;
  occurredOn: string;
  expectedRepaymentDate: string;
  note: string;
};

const sectionTitles: Record<TransferDirection, string> = {
  lend: "Lending",
  collect: "Repayment",
  borrow: "Borrowing",
  repay: "Repayment",
};

const outstandingLabels: Record<TransferDirection, string> = {
  lend: "Already owes you",
  collect: "Owes you",
  borrow: "You already owe",
  repay: "You owe",
};

const settlingDirections = new Set<TransferDirection>(["collect", "repay"]);

function loanOptions(accounts: Account[]) {
  return accounts
    .filter((account) => account.type === "debt")
    .map((account) => {
      const outstanding = Math.max(0, -account.balance);
      return {
        value: account.id,
        label:
          outstanding > 0
            ? `${account.name} · ${formatMoney(outstanding, "UGX")} left`
            : account.name,
      };
    });
}

function loanCaption(loan: Account | undefined): string | null {
  return loan?.debtStartDate ? `since ${formatDate(loan.debtStartDate)}` : null;
}

function partyCaption(advancedOn: string | null): string | null {
  return advancedOn ? `since ${formatDate(advancedOn)}` : null;
}

export function createDefaultTransactionForm(): TransactionFormState {
  return { ...defaultTransactionFormShape, occurredOn: todayIso() };
}

const defaultTransactionFormShape: TransactionFormState = {
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
  occurredOn: "",
  expectedRepaymentDate: "",
  note: "",
};

type Props = {
  accounts: Account[];
  categories: Category[];
  categoryUsage?: Map<string, number>;
  onCreateCategory?: (name: string, kind: CategoryKind) => void;
  counterparties: Counterparty[];
  transactions: Transaction[];
  form: TransactionFormState;
  editingId: string | null;
  isSubmitting: boolean;
  lastSavedAt: string | null;
  successMessage: string | null;
  rememberedFxHint?: string | null;
  onFormChange: (updater: (prev: TransactionFormState) => TransactionFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  embedded?: boolean;
  bare?: boolean;
};

export function TransactionForm({
  accounts,
  categories,
  categoryUsage,
  onCreateCategory,
  counterparties,
  transactions,
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

  const amountForPreview = hasValidNormalizedAmount ? normalizedUgxAmount : 0;

  const parties = useMemo(() => {
    if (!counterparty) return [];
    const asOf = new Date();
    const portfolio =
      counterparty.direction === "lend" || counterparty.direction === "collect"
        ? getLendingPortfolio(accounts, transactions, asOf, counterparties)
        : getBorrowingPortfolio(accounts, transactions, asOf, counterparties);
    return portfolio.parties;
  }, [accounts, counterparties, counterparty, transactions]);

  const party = parties.find((entry) => entry.counterpartyId === form.counterpartyId);
  const partyPreview = party
    ? previewPartyRepayment({ party, paymentAmount: amountForPreview })
    : null;

  const loan = accounts.find(
    (account) => account.id === form.destinationAccountId && account.type === "debt",
  );
  const loanPreview =
    form.type === "debt_payment" && loan
      ? previewLoanRepayment({
          loan,
          transactions,
          paymentAmount: amountForPreview,
          occurredOn: form.occurredOn,
        })
      : null;

  const canFillAmount = form.currency === "UGX";
  const fillAmount = (value: number) =>
    onFormChange((current) => ({ ...current, amount: String(Math.round(value)) }));

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

          <CategoryField
            categories={categories}
            value={form.categoryId}
            type={form.type}
            usage={categoryUsage}
            onCreate={onCreateCategory}
            onSelect={(picked) =>
              onFormChange((c) => ({
                ...c,
                categoryId: picked.id,
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
            <RepaymentSection title="Loan payment">
              <SelectField
                id="tx-loan"
                label="Which loan"
                value={form.destinationAccountId}
                placeholder="Select loan"
                options={loanOptions(accounts)}
                onValueChange={(v) => onFormChange((c) => ({ ...c, destinationAccountId: v }))}
              />
              {loanPreview ? (
                <RepaymentSummary
                  preview={loanPreview}
                  outstandingLabel="Still owed"
                  caption={loanCaption(loan)}
                  settling
                  canPayAll={canFillAmount}
                  onPayAll={() => fillAmount(loanPreview.payoffAmount)}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Interest and principal are separated automatically from the loan&apos;s rate.
                </p>
              )}
            </RepaymentSection>
          ) : null}

          {counterparty ? (
            <>
              {counterparty.requiresPayee ? (
                <RepaymentSection title={sectionTitles[counterparty.direction]}>
                  <PersonField
                    label={counterparty.label}
                    placeholder="Search or add a person"
                    counterparties={counterparties}
                    direction={counterparty.direction}
                    value={form.counterpartyId}
                    newName={form.counterpartyName}
                    subtitleFor={(person) => {
                      const owed = parties.find(
                        (entry) => entry.counterpartyId === person.id,
                      )?.outstanding;
                      return owed && owed > 0
                        ? `${outstandingLabels[counterparty.direction]} ${formatMoney(owed, "UGX")}`
                        : null;
                    }}
                    onSelect={(counterpartyId) =>
                      onFormChange((c) => ({ ...c, counterpartyId, counterpartyName: "" }))
                    }
                    onAdd={(name) =>
                      onFormChange((c) => ({
                        ...c,
                        counterpartyId: NEW_COUNTERPARTY,
                        counterpartyName: name,
                      }))
                    }
                  />
                  {partyPreview ? (
                    <RepaymentSummary
                      preview={partyPreview}
                      outstandingLabel={outstandingLabels[counterparty.direction]}
                      caption={partyCaption(party?.advancedOn ?? null)}
                      settling={settlingDirections.has(counterparty.direction)}
                      canPayAll={canFillAmount && settlingDirections.has(counterparty.direction)}
                      onPayAll={() => fillAmount(partyPreview.payoffAmount)}
                    />
                  ) : form.counterpartyId === NEW_COUNTERPARTY ? (
                    <p className="text-xs text-muted-foreground">
                      {form.counterpartyName || "This person"} is added to your people, so next
                      time you pick them from the list.
                    </p>
                  ) : null}
                </RepaymentSection>
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
                size="lg"
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
