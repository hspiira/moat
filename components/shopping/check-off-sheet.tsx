"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { estimatePlannedTotal } from "@/lib/domain/planned-purchases";
import { formatDate } from "@/lib/format-date";
import { parseAmountInput } from "@/lib/parse-amount";
import type { Account, Category, PlannedPurchase, Transaction } from "@/lib/types";

import type { CheckOffTarget } from "./use-shopping-workspace";

function emptyForm() {
  return {
    accountId: "",
    categoryId: "",
    payee: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    amount: "",
  };
}

export function CheckOffSheet({
  open,
  selected,
  recentExpenses,
  accounts,
  expenseCategories,
  isSubmitting,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  selected: PlannedPurchase[];
  recentExpenses: Transaction[];
  accounts: Account[];
  expenseCategories: Category[];
  isSubmitting: boolean;
  onConfirm: (target: CheckOffTarget) => void;
  onOpenChange: (open: boolean) => void;
}) {
  // The sheet content stays mounted across opens (Radix animates it out
  // rather than unmounting), so its form state would otherwise survive a
  // close/reopen — most dangerously, an "attach" target left pointing at an
  // already-used expense. Bumping a session key on each open→true transition
  // forces a fresh mount of the form, which resets its state for free. Done
  // during render (the React-endorsed way to react to a prop change) rather
  // than in an effect, so it doesn't trigger a second render pass.
  const [wasOpen, setWasOpen] = useState(open);
  const [sessionKey, setSessionKey] = useState(0);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSessionKey((key) => key + 1);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Record {selected.length === 1 ? "purchase" : "purchases"}</SheetTitle>
          <SheetDescription>
            Attach {selected.length === 1 ? "this item" : `these ${selected.length} items`} to
            the expense that paid for {selected.length === 1 ? "it" : "them"}.
          </SheetDescription>
        </SheetHeader>

        <CheckOffSheetForm
          key={sessionKey}
          selected={selected}
          recentExpenses={recentExpenses}
          accounts={accounts}
          expenseCategories={expenseCategories}
          isSubmitting={isSubmitting}
          onConfirm={onConfirm}
        />
      </SheetContent>
    </Sheet>
  );
}

function CheckOffSheetForm({
  selected,
  recentExpenses,
  accounts,
  expenseCategories,
  isSubmitting,
  onConfirm,
}: {
  selected: PlannedPurchase[];
  recentExpenses: Transaction[];
  accounts: Account[];
  expenseCategories: Category[];
  isSubmitting: boolean;
  onConfirm: (target: CheckOffTarget) => void;
}) {
  const [mode, setMode] = useState<"attach" | "create">("attach");
  const [transactionId, setTransactionId] = useState("");
  const estimate = estimatePlannedTotal(selected);
  const [form, setForm] = useState(emptyForm);

  const createAmount = parseAmountInput(form.amount) ?? estimate.total;
  const canConfirm =
    mode === "attach"
      ? transactionId !== ""
      : form.accountId !== "" && form.categoryId !== "" && createAmount > 0;

  const confirm = () => {
    onConfirm(
      mode === "attach"
        ? { mode: "attach", transactionId }
        : {
            mode: "create",
            accountId: form.accountId,
            categoryId: form.categoryId,
            payee: form.payee,
            occurredOn: form.occurredOn,
            amount: createAmount,
          },
    );
  };

  return (
    <div className="grid gap-4 p-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === "attach" ? "default" : "outline"}
          onClick={() => setMode("attach")}
        >
          Existing expense
        </Button>
        <Button
          size="sm"
          variant={mode === "create" ? "default" : "outline"}
          onClick={() => setMode("create")}
        >
          New expense
        </Button>
      </div>

      {mode === "attach" ? (
        <div className="grid gap-1">
          <Label>Expense</Label>
          <Select value={transactionId} onValueChange={setTransactionId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a recent expense" />
            </SelectTrigger>
            <SelectContent>
              {recentExpenses.map((expense) => (
                <SelectItem key={expense.id} value={expense.id}>
                  {formatDate(expense.occurredOn)} · {expense.payee ?? "No payee"} ·{" "}
                  {formatMoney(expense.amount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Account</Label>
            <Select
              value={form.accountId}
              onValueChange={(accountId) => setForm({ ...form, accountId })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Paid from" />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((account) => !account.isArchived)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Category</Label>
            <Select
              value={form.categoryId}
              onValueChange={(categoryId) => setForm({ ...form, categoryId })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="check-off-payee">Where (payee)</Label>
            <Input
              id="check-off-payee"
              value={form.payee}
              placeholder="Mega Standard"
              onChange={(event) => setForm({ ...form, payee: event.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="check-off-date">Date</Label>
            <DatePicker
              id="check-off-date"
              value={form.occurredOn}
              onChange={(occurredOn) => setForm({ ...form, occurredOn })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="check-off-amount">Total amount</Label>
            <Input
              id="check-off-amount"
              inputMode="numeric"
              value={form.amount}
              placeholder={formatMoney(estimate.total)}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Estimated <Money amount={estimate.total} tone="neutral" /> from the selected
              items; adjust to the real receipt total.
            </p>
          </div>
        </div>
      )}

      <Button disabled={!canConfirm || isSubmitting} onClick={confirm}>
        Record
      </Button>
    </div>
  );
}
