"use client";

import type {
  AccountType,
  DebtInterestModel,
  DebtLenderType,
  DebtRepaymentFrequency,
} from "@/lib/types";
import { AccentCardHeader } from "@/components/accent-card-header";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
import {
  accountTypeOptions,
  debtInterestModelLabels,
  debtLenderTypeLabels,
  debtRepaymentFrequencyLabels,
  optionsFromRecord,
} from "@/lib/select-options";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

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

export const defaultAccountForm: AccountFormState = {
  name: "",
  type: "cash",
  institutionName: "",
  openingBalance: "0",
  debtPrincipal: "",
  debtInterestRate: "",
  debtInterestModel: "reducing_balance",
  debtLenderType: "bank",
  debtStartDate: new Date().toISOString().slice(0, 10),
  debtTermMonths: "",
  debtRepaymentFrequency: "monthly",
  notes: "",
};

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
};

export function AccountForm({
  accountTypes,
  form,
  editingId,
  isSubmitting,
  lastSavedAt,
  successMessage,
  onFormChange,
  onSubmit,
  onCancelEdit,
}: Props) {
  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <AccentCardHeader
        tone="yellow"
        title={editingId ? "Edit account" : "Add account"}
        description={
          editingId
            ? "Update the details for this account."
            : "Name it once and track it clearly."
        }
      />
      <CardContent className="p-5">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <LocalSaveFeedback
            isSubmitting={isSubmitting}
            lastSavedAt={lastSavedAt}
            successMessage={successMessage}
          />

          <InputField
            id="account-name"
            label="Account name"
            value={form.name}
            onChange={(e) => onFormChange((c) => ({ ...c, name: e.target.value }))}
            placeholder="e.g. MTN Mobile Money"
            required
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
            label="Opening balance (UGX)"
            inputMode="decimal"
            value={form.openingBalance}
            onChange={(e) => onFormChange((c) => ({ ...c, openingBalance: e.target.value }))}
            required
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
                <div className="grid gap-2">
                  <InputField
                    id="debt-start-date"
                    label="Start date"
                    type="date"
                    value={form.debtStartDate}
                    onChange={(e) =>
                      onFormChange((c) => ({ ...c, debtStartDate: e.target.value }))
                    }
                  />
                </div>
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

          <div className="flex flex-wrap gap-2">
            <Button disabled={isSubmitting} type="submit" size="sm">
              {isSubmitting ? "Saving..." : editingId ? "Update account" : "Add account"}
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
