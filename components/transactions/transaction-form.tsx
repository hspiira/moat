"use client";

import type { Account, Category, TransactionType } from "@/lib/types";
import { LocalSaveFeedback } from "@/components/local-save-feedback";
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

  return (
    <Card className="gap-0 pt-0 border-border/20 shadow-none">
      <CardHeader className="moat-panel-yellow min-h-20 gap-1 border-b border-border/20 py-3 text-foreground">
        <CardTitle className="text-lg text-foreground">
          {editingId ? "Edit transaction" : "Add transaction"}
        </CardTitle>
        <CardDescription className="text-foreground/72 leading-6">
          {editingId
            ? "Update this transaction."
            : "Record one money event against one account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <LocalSaveFeedback
            isSubmitting={isSubmitting}
            lastSavedAt={lastSavedAt}
            successMessage={successMessage}
          />

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
