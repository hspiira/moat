"use client";

import type {
  AccountType,
  DebtInterestModel,
  DebtLenderType,
  DebtRepaymentFrequency,
} from "@/lib/types";
import { todayIso } from "@/lib/today";
import { FormCardShell } from "@/components/forms/form-card-shell";
import { InputField } from "@/components/forms/input-field";
import { DatePickerField } from "@/components/forms/date-picker-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import {
  accountTypeOptions,
  debtInterestModelLabels,
  debtLenderTypeLabels,
  debtRepaymentFrequencyLabels,
  optionsFromRecord,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";

export { accountTypeLabels } from "@/lib/select-options";

export type AccountFormState = {
  name: string;
  type: AccountType;
  institutionName: string;
  openingBalance: string;
  debtPrincipal: string;
  debtInterestRate: string;
  debtInterestModel: DebtInterestModel;
  debtLenderType: DebtLenderType;
  debtStartDate: string;
  debtTermMonths: string;
  debtRepaymentFrequency: DebtRepaymentFrequency;
  notes: string;
};

export function createDefaultAccountForm(): AccountFormState {
  return {
    name: "",
    type: "cash",
    institutionName: "",
    openingBalance: "0",
    debtPrincipal: "",
    debtInterestRate: "",
    debtInterestModel: "reducing_balance",
    debtLenderType: "bank",
    debtStartDate: todayIso(),
    debtTermMonths: "",
    debtRepaymentFrequency: "monthly",
    notes: "",
  };
}

type Props = {
  accountTypes: AccountType[];
  form: AccountFormState;
  editingId: string | null;
  isSubmitting: boolean;
  lastSavedAt: string | null;
  successMessage: string | null;
  onFormChange: (updater: (prev: AccountFormState) => AccountFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  fieldErrors?: { name?: string; openingBalance?: string };
  embedded?: boolean;
};

export function AccountForm(props: Props) {
  const { embedded, editingId, isSubmitting, onCancelEdit } = props;
  const title = editingId ? "Edit account" : "Add account";
  const description = editingId
    ? "Update the details for this account."
    : "Name it once and track it clearly.";

  const footer = (
    <div className="flex gap-2">
      <Button type="submit" form="account-form" disabled={isSubmitting} size="lg" className="flex-1">
        {isSubmitting ? "Saving…" : editingId ? "Update account" : "Add account"}
      </Button>
      {editingId ? (
        <Button type="button" variant="outline" size="lg" onClick={onCancelEdit}>
          Cancel
        </Button>
      ) : null}
    </div>
  );

  return (
    <FormCardShell embedded={embedded} title={title} description={description} footer={footer}>
      <AccountFormBody {...props} />
    </FormCardShell>
  );
}

function AccountFormBody({
  accountTypes,
  form,
  onFormChange,
  onSubmit,
  fieldErrors,
}: Props) {
  return (
    <form id="account-form" className="grid gap-4" onSubmit={onSubmit} noValidate>
          <InputField
            id="account-name"
            label={
              form.type === "receivable" ? "Who borrowed it" : "Account name"
            }
            value={form.name}
            onChange={(e) => onFormChange((c) => ({ ...c, name: e.target.value }))}
            placeholder={
              form.type === "receivable" ? "e.g. Loan to Sarah" : "e.g. MTN Mobile Money"
            }
            error={fieldErrors?.name}
            autoFocus
          />

          <div className="grid gap-2">
            <SelectField
              id="account-type"
              label="Account type"
              value={form.type}
              options={accountTypeOptions(accountTypes)}
              onValueChange={(value) =>
                onFormChange((c) => ({ ...c, type: value as AccountType }))
              }
            />
          </div>

          <InputField
            id="institution-name"
            label="Institution name"
            value={form.institutionName}
            onChange={(e) => onFormChange((c) => ({ ...c, institutionName: e.target.value }))}
            placeholder="Optional — e.g. Stanbic Bank"
          />

          <InputField
            id="opening-balance"
            label={
              form.type === "receivable"
                ? "Already owed to you (UGX)"
                : "Opening balance (UGX)"
            }
            inputMode="decimal"
            value={form.openingBalance}
            onChange={(e) => onFormChange((c) => ({ ...c, openingBalance: e.target.value }))}
            error={fieldErrors?.openingBalance}
            hint={
              form.type === "receivable"
                ? "Only for money already owed to you before you started using Moat. New loans are recorded as transactions, not here."
                : undefined
            }
          />

          {form.type === "debt" ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <InputField
                    id="debt-principal"
                    label="Principal (UGX)"
                    inputMode="decimal"
                    value={form.debtPrincipal}
                    onChange={(e) =>
                      onFormChange((c) => ({ ...c, debtPrincipal: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <InputField
                    id="debt-interest-rate"
                    label="Interest rate (%)"
                    inputMode="decimal"
                    value={form.debtInterestRate}
                    onChange={(e) =>
                      onFormChange((c) => ({ ...c, debtInterestRate: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <SelectField
                    id="debt-interest-model"
                    label="Interest model"
                    value={form.debtInterestModel}
                    options={optionsFromRecord(debtInterestModelLabels)}
                    onValueChange={(value) =>
                      onFormChange((c) => ({
                        ...c,
                        debtInterestModel: value as DebtInterestModel,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <SelectField
                    id="debt-lender-type"
                    label="Lender type"
                    value={form.debtLenderType}
                    options={optionsFromRecord(debtLenderTypeLabels)}
                    onValueChange={(value) =>
                      onFormChange((c) => ({
                        ...c,
                        debtLenderType: value as DebtLenderType,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <DatePickerField
                  id="debt-start-date"
                  label="Start date"
                  value={form.debtStartDate}
                  onChange={(value) => onFormChange((c) => ({ ...c, debtStartDate: value }))}
                />
                <div className="grid gap-2">
                  <InputField
                    id="debt-term-months"
                    label="Term (months)"
                    inputMode="numeric"
                    value={form.debtTermMonths}
                    onChange={(e) =>
                      onFormChange((c) => ({ ...c, debtTermMonths: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <SelectField
                  id="debt-frequency"
                  label="Repayment frequency"
                  value={form.debtRepaymentFrequency}
                  options={optionsFromRecord(debtRepaymentFrequencyLabels)}
                  onValueChange={(value) =>
                    onFormChange((c) => ({
                      ...c,
                      debtRepaymentFrequency: value as DebtRepaymentFrequency,
                    }))
                  }
                />
              </div>
            </>
          ) : null}

          <TextareaField
            id="account-notes"
            label="Notes"
            value={form.notes}
            onChange={(e) => onFormChange((c) => ({ ...c, notes: e.target.value }))}
            placeholder="Optional"
            className="min-h-20"
          />
    </form>
  );
}
