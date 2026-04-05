"use client";

import type { Account, Category, TransactionType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
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

export type TransactionFormState = {
  type: TransactionType;
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  amount: string;
  occurredOn: string;
  note: string;
};

export const defaultTransactionForm: TransactionFormState = {
  type: "expense",
  accountId: "",
  destinationAccountId: "",
  categoryId: "",
  amount: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  note: "",
};

export const transactionTypeLabels: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  savings_contribution: "Savings contribution",
  debt_payment: "Debt payment",
  transfer: "Transfer",
};

/**
 * Determine whether a Category is valid for a given TransactionType.
 *
 * @param category - The category to test
 * @param type - The transaction type to match
 * @returns `true` if `category.kind` corresponds to `type` (`"income"` → `"income"`, `"transfer"` → `"transfer"`, `"savings_contribution"` → `"savings"`, all other types → `"expense"`), `false` otherwise
 */
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
  onFormChange: (updater: (prev: TransactionFormState) => TransactionFormState) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
};

/**
 * Renders a card containing a transaction form for creating or editing an entry.
 *
 * The form supports selecting a transaction type, source account, optional destination account
 * (shown only for transfers), a category filtered to the selected type, amount, date, and note.
 * The submit button label and presence of a cancel action change when `editingId` is provided.
 *
 * @param accounts - Available accounts to choose from
 * @param categories - Available categories used to populate the category selector (filtered by selected transaction type)
 * @param form - Current form state values
 * @param editingId - If truthy, the form is in edit mode for the transaction with this id
 * @param isSubmitting - When true, disables the submit button and shows a saving label
 * @param onFormChange - Updater callback invoked with a function that receives previous form state and returns the next state
 * @param onSubmit - Form submit handler
 * @param onCancelEdit - Handler invoked when cancelling edit mode (rendered only when `editingId` is truthy)
 * @returns A React element representing the transaction form UI
 */
export function TransactionForm({
  accounts,
  categories,
  form,
  editingId,
  isSubmitting,
  onFormChange,
  onSubmit,
  onCancelEdit,
}: Props) {
  const availableCategories = categories.filter((c) => categoryMatchesType(c, form.type));

  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">
          {editingId ? "Edit transaction" : "Add transaction"}
        </CardTitle>
        <CardDescription>
          {editingId
            ? "Update this transaction."
            : "Record a single money event against an account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="tx-type">Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => {
                const nextType = v as TransactionType;
                onFormChange((c) => ({
                  ...c,
                  type: nextType,
                  categoryId:
                    categories.find((cat) => categoryMatchesType(cat, nextType))?.id ?? "",
                }));
              }}
            >
              <SelectTrigger id="tx-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(transactionTypeLabels) as TransactionType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {transactionTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-account">
              {form.type === "transfer" ? "From account" : "Account"}
            </Label>
            <Select
              value={form.accountId}
              onValueChange={(v) => onFormChange((c) => ({ ...c, accountId: v }))}
            >
              <SelectTrigger id="tx-account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.type === "transfer" ? (
            <div className="grid gap-2">
              <Label htmlFor="tx-dest">To account</Label>
              <Select
                value={form.destinationAccountId}
                onValueChange={(v) => onFormChange((c) => ({ ...c, destinationAccountId: v }))}
              >
                <SelectTrigger id="tx-dest">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="tx-category">Category</Label>
            <Select
              value={form.categoryId}
              onValueChange={(v) => onFormChange((c) => ({ ...c, categoryId: v }))}
            >
              <SelectTrigger id="tx-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tx-amount">Amount (UGX)</Label>
            <Input
              id="tx-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => onFormChange((c) => ({ ...c, amount: e.target.value }))}
              required
            />
          </div>

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
