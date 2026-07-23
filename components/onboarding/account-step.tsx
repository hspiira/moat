"use client";

import { defaultAccountTypes } from "@/lib/app-state/defaults";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { accountTypeOptions } from "@/lib/select-options";
import type { Account } from "@/lib/types";

import type { AccountSetupState } from "./use-onboarding-workspace";

type Props = {
  account: AccountSetupState;
  onAccountChange: (updater: (prev: AccountSetupState) => AccountSetupState) => void;
};

export function AccountStep({ account, onAccountChange }: Props) {
  return (
    <>
      <InputField
        id="account-name"
        label="Account name"
        value={account.name}
        onChange={(e) => onAccountChange((c) => ({ ...c, name: e.target.value }))}
        placeholder="e.g. MTN Mobile Money"
        hint="Start with the place where most of your day-to-day money moves."
        required
      />

      <SelectField
        id="account-type"
        label="Account type"
        value={account.type}
        options={accountTypeOptions(defaultAccountTypes)}
        onValueChange={(value) =>
          onAccountChange((c) => ({ ...c, type: value as Account["type"] }))
        }
      />

      <InputField
        id="institution-name"
        label="Institution name"
        value={account.institutionName}
        onChange={(e) =>
          onAccountChange((c) => ({ ...c, institutionName: e.target.value }))
        }
        placeholder="Optional — e.g. Stanbic, MTN, your SACCO"
      />

      <InputField
        id="opening-balance"
        label={`Opening balance (${account.type === "debt" ? "owed" : "available"}) in UGX`}
        inputMode="decimal"
        value={account.openingBalance}
        onChange={(e) =>
          onAccountChange((c) => ({ ...c, openingBalance: e.target.value }))
        }
        hint={
          account.type === "debt"
            ? "Debt balances are stored as negative starting balances."
            : "This becomes your starting point before any transactions are added."
        }
        required
      />
    </>
  );
}
