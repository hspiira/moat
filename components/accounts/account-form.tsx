"use client";

import type { Account, AccountType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type AccountFormState = {
  name: string;
  type: AccountType;
  institutionName: string;
  openingBalance: string;
  notes: string;
};

export const defaultAccountForm: AccountFormState = {
  name: "",
  type: "cash",
  institutionName: "",
  openingBalance: "0",
  notes: "",
};

export const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  bank: "Bank Account",
  sacco: "SACCO",
  investment: "Investment",
  debt: "Debt / Obligation",
};

type Props = {
  accountTypes: AccountType[];
  form: AccountFormState;
  editingId: string | null;
  isSubmitting: boolean;
  onFormChange: (updater: (prev: AccountFormState) => AccountFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
};

/**
 * Render a card containing a form for adding a new account or editing an existing one.
 *
 * @param accountTypes - Available account types to show in the type select
 * @param form - Current form state (fields: `name`, `type`, `institutionName`, `openingBalance`, `notes`)
 * @param editingId - Id of the account being edited, or `null` when adding a new account
 * @param isSubmitting - When true, disables the submit button and updates its label
 * @param onFormChange - Functional updater called with a state updater to modify the form
 * @param onSubmit - Form submit handler for creating or updating the account
 * @param onCancelEdit - Called to exit edit mode when `editingId` is present
 * @returns The rendered account form React element
 */
export function AccountForm({
  accountTypes,
  form,
  editingId,
  isSubmitting,
  onFormChange,
  onSubmit,
  onCancelEdit,
}: Props) {
  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">
          {editingId ? "Edit account" : "Add account"}
        </CardTitle>
        <CardDescription>
          {editingId ? "Update the details for this account." : "Add a new account to track."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              value={form.name}
              onChange={(e) => onFormChange((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. MTN Mobile Money"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="account-type">Account type</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                onFormChange((c) => ({ ...c, type: value as AccountType }))
              }
            >
              <SelectTrigger id="account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {accountTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="institution-name">Institution name</Label>
            <Input
              id="institution-name"
              value={form.institutionName}
              onChange={(e) => onFormChange((c) => ({ ...c, institutionName: e.target.value }))}
              placeholder="Optional — e.g. Stanbic Bank"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="opening-balance">Opening balance (UGX)</Label>
            <Input
              id="opening-balance"
              inputMode="decimal"
              value={form.openingBalance}
              onChange={(e) => onFormChange((c) => ({ ...c, openingBalance: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="account-notes">Notes</Label>
            <Textarea
              id="account-notes"
              value={form.notes}
              onChange={(e) => onFormChange((c) => ({ ...c, notes: e.target.value }))}
              placeholder="Optional"
              className="min-h-20"
            />
          </div>

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
