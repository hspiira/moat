"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { isInstallmentPurchase, summariseInstallments } from "@/lib/domain/installments";
import { Button } from "@/components/ui/button";
import { FormCardShell } from "@/components/forms/form-card-shell";
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
import { sumFulfillmentCost } from "@/lib/domain/planned-purchases";
import { formatDate } from "@/lib/format-date";
import { parseAmountInput } from "@/lib/parse-amount";
import type {
  Account,
  Category,
  Item,
  PlannedPurchase,
  Transaction,
  TransactionLineItem,
} from "@/lib/types";

import type { CheckOffTarget, FulfillmentActual } from "./use-shopping-workspace";
import { todayIso } from "@/lib/today";

function emptyForm() {
  return {
    accountId: "",
    categoryId: "",
    payee: "",
    occurredOn: todayIso(),
    amount: "",
  };
}

export function CheckOffSheet({
  open,
  selected,
  items,
  recentExpenses,
  accounts,
  expenseCategories,
  lineItems,
  isSubmitting,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  selected: PlannedPurchase[];
  items: Item[];
  recentExpenses: Transaction[];
  accounts: Account[];
  expenseCategories: Category[];
  lineItems: TransactionLineItem[];
  isSubmitting: boolean;
  onConfirm: (target: CheckOffTarget, actuals: FulfillmentActual[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [wasOpen, setWasOpen] = useState(open);
  const [sessionKey, setSessionKey] = useState(0);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSessionKey((key) => key + 1);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="sr-only">
          <SheetTitle>Record {selected.length === 1 ? "purchase" : "purchases"}</SheetTitle>
          <SheetDescription>
            Attach {selected.length === 1 ? "this item" : `these ${selected.length} items`} to
            the expense that paid for {selected.length === 1 ? "it" : "them"}.
          </SheetDescription>
        </SheetHeader>

        <FormCardShell
          embedded
          title={`Record ${selected.length === 1 ? "purchase" : "purchases"}`}
          description={`Attach ${selected.length === 1 ? "this item" : `these ${selected.length} items`} to the expense that paid for ${selected.length === 1 ? "it" : "them"}.`}
        >
          <CheckOffSheetForm
            key={sessionKey}
            selected={selected}
            items={items}
            recentExpenses={recentExpenses}
            accounts={accounts}
            expenseCategories={expenseCategories}
            lineItems={lineItems}
            isSubmitting={isSubmitting}
            onConfirm={onConfirm}
          />
        </FormCardShell>
      </SheetContent>
    </Sheet>
  );
}

function CheckOffSheetForm({
  selected,
  items,
  recentExpenses,
  accounts,
  expenseCategories,
  lineItems,
  isSubmitting,
  onConfirm,
}: {
  selected: PlannedPurchase[];
  items: Item[];
  recentExpenses: Transaction[];
  accounts: Account[];
  expenseCategories: Category[];
  /** Payments already made, so a part-paid item can show what is left. */
  lineItems: TransactionLineItem[];
  isSubmitting: boolean;
  onConfirm: (target: CheckOffTarget, actuals: FulfillmentActual[]) => void;
}) {
  const [mode, setMode] = useState<"attach" | "create">("attach");
  const plans = new Map(
    selected
      .filter(isInstallmentPurchase)
      .map((purchase) => [purchase.id, summariseInstallments(purchase, lineItems)] as const),
  );
  const [transactionId, setTransactionId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const [actuals, setActuals] = useState<Record<string, { quantity: string; unitPrice: string }>>(
    () =>
      Object.fromEntries(
        selected.map((purchase) => [
          purchase.id,
          {
            quantity: String(purchase.quantity ?? 1),
            // The estimate is a reference only. Leaving actual blank must not
            // silently turn a plan into a recorded price.
            unitPrice: "",
          },
        ]),
      ),
  );

  const resolvedActuals = selected.map((purchase) => ({
    purchaseId: purchase.id,
    quantity: parseAmountInput(actuals[purchase.id]?.quantity ?? "") ?? undefined,
    unitPrice: parseAmountInput(actuals[purchase.id]?.unitPrice ?? "") ?? undefined,
  }));
  const createAmount = sumFulfillmentCost(resolvedActuals);
  const unpricedCount = resolvedActuals.filter((entry) => entry.unitPrice == null).length;
  const hasActualForAll = unpricedCount === 0;

  const canConfirm =
    mode === "attach"
      ? transactionId !== "" && hasActualForAll
      : form.accountId !== "" &&
        form.categoryId !== "" &&
        createAmount > 0 &&
        hasActualForAll;

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
      resolvedActuals,
    );
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          What did they cost? Enter the actual price; the planned amount is only a reference.
        </p>
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2 px-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span />
          <span className="w-14 text-right">Qty</span>
          <span className="w-24 text-right">Actual / unit</span>
        </div>
        <ul className="grid gap-2">
          {selected.map((purchase) => {
            const draft = actuals[purchase.id] ?? { quantity: "1", unitPrice: "" };
            const plannedAmount =
              purchase.estimatedUnitPrice != null
                ? (purchase.quantity ?? 1) * purchase.estimatedUnitPrice
                : undefined;
            const itemName = itemsById.get(purchase.itemId)?.name ?? "Item";
            const update = (patch: Partial<typeof draft>) =>
              setActuals((current) => ({
                ...current,
                [purchase.id]: { ...draft, ...patch },
              }));

            return (
              <li key={purchase.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {itemName}
                  </span>
                  {plannedAmount != null ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      planned {formatMoney(plannedAmount)}
                    </span>
                  ) : null}
                  {plans.get(purchase.id) ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatMoney(plans.get(purchase.id)!.remaining)} of{" "}
                      {formatMoney(plans.get(purchase.id)!.expected)} still to pay
                    </span>
                  ) : null}
                </span>
                <Input
                  aria-label="Quantity"
                  inputMode="decimal"
                  className="w-14 text-right"
                  value={draft.quantity}
                  onChange={(event) => update({ quantity: event.target.value })}
                />
                <Input
                  aria-label={`Actual unit price for ${itemName}`}
                  inputMode="decimal"
                  className="w-24 text-right"
                  placeholder={
                    purchase.estimatedUnitPrice != null
                      ? `planned ${formatMoney(purchase.estimatedUnitPrice)}`
                      : "actual price"
                  }
                  value={draft.unitPrice}
                  onChange={(event) => update({ unitPrice: event.target.value })}
                />
              </li>
            );
          })}
        </ul>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Total</span>
          {createAmount > 0 ? (
            <Money amount={createAmount} tone="neutral" className="font-semibold" />
          ) : (
            <span className="text-xs text-muted-foreground">Enter actual prices</span>
          )}
        </div>
        {unpricedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {unpricedCount} item{unpricedCount === 1 ? "" : "s"} still need
            {unpricedCount === 1 ? "s" : ""} an actual price before this purchase can be recorded.
          </p>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Where the money came from"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted/30 p-0.5"
      >
        {(["attach", "create"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={mode === option}
            onClick={() => setMode(option)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "attach" ? "An expense I have" : "A new expense"}
          </button>
        ))}
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
          <p className="text-xs text-muted-foreground">
            Total comes from the prices above, so the expense and its items always
            agree.
          </p>
        </div>
      )}

      <Button disabled={!canConfirm || isSubmitting} onClick={confirm}>
        Record
      </Button>
    </div>
  );
}
