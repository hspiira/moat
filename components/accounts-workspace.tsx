"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";

import { defaultAccountTypes } from "@/lib/app-state/defaults";
import { getAccountTotals } from "@/lib/domain/accounts";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { AccountForm } from "./accounts/account-form";
import { AccountList } from "./accounts/account-list";
import { DebtPayoffPlanner } from "./accounts/debt-payoff-planner";
import { RepairAccountsPanel } from "./accounts/repair-accounts-panel";
import { useAccountsWorkspace } from "./accounts/use-accounts-workspace";

export function AccountsWorkspace() {
  const {
    profile,
    accounts,
    transactions,
    accountForm,
    editingAccountId,
    isLoading,
    isSubmitting,
    error,
    lastSavedAt,
    successMessage,
    setAccountForm,
    handleAccountSubmit,
    handleRepairAccounts,
    beginAccountEdit,
    cancelEdit,
  } = useAccountsWorkspace();

  const accountTotals = getAccountTotals(accounts);
  const typesSetUp = defaultAccountTypes.filter(
    (type) => accountTotals.accountsByType[type] > 0,
  ).length;

  const [isFormOpen, setIsFormOpen] = useState(false);

  function openAddAccount() {
    cancelEdit();
    setIsFormOpen(true);
  }

  function openEditAccount(account: Parameters<typeof beginAccountEdit>[0]) {
    beginAccountEdit(account);
    setIsFormOpen(true);
  }

  function handleFormOpenChange(open: boolean) {
    setIsFormOpen(open);
    if (!open) {
      cancelEdit();
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Accounts"
        description="Manage the accounts where you hold and move money."
        aside={
          profile ? (
            <Button size="lg" onClick={openAddAccount}>
              <IconPlus />
              Add account
            </Button>
          ) : null
        }
      />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message="Loading accounts..." /> : null}
      {!isLoading && !profile ? (
        <SetupRequiredCard
          message="Complete onboarding to start adding accounts."
          href="/onboarding"
          cta="Set up your profile"
        />
      ) : null}

      {!isLoading && profile ? (
        <>
          <RepairAccountsPanel
            accounts={accounts}
            transactions={transactions}
            isSubmitting={isSubmitting}
            onRepair={handleRepairAccounts}
          />

          <Card className="ring-1 ring-primary/15">
            <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-8 sm:px-6">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Total balance
                </p>
                <div className="font-display text-[clamp(1.75rem,8vw,2.5rem)] leading-none font-semibold tracking-tight">
                  <Money
                    amount={accountTotals.totalBalance}
                    tone={accountTotals.totalBalance < 0 ? "negative" : "neutral"}
                    className="font-display"
                  />
                </div>
              </div>
              <dl className="flex items-end gap-8 text-sm">
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Accounts</dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {accountTotals.activeAccounts}
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Types</dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {typesSetUp}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {defaultAccountTypes.length}
                    </span>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <AccountList
            accounts={accounts}
            transactions={transactions}
            onEdit={openEditAccount}
            onAdd={openAddAccount}
          />

          <DebtPayoffPlanner accounts={accounts} transactions={transactions} />

          <Sheet open={isFormOpen} onOpenChange={handleFormOpenChange}>
            <SheetContent
              side="right"
              className="w-full gap-0 overflow-y-auto sm:max-w-md"
            >
              <SheetHeader>
                <SheetTitle className="font-display">
                  {editingAccountId ? "Edit account" : "Add account"}
                </SheetTitle>
                <SheetDescription>
                  {editingAccountId
                    ? "Update the details for this account."
                    : "Name it once and track it clearly."}
                </SheetDescription>
              </SheetHeader>
              <div className="pt-2">
                <AccountForm
                  embedded
                  accountTypes={defaultAccountTypes}
                  form={accountForm}
                  editingId={editingAccountId}
                  isSubmitting={isSubmitting}
                  lastSavedAt={lastSavedAt}
                  successMessage={successMessage}
                  onFormChange={setAccountForm}
                  onSubmit={async (e) => {
                    const ok = await handleAccountSubmit(e);
                    if (ok) {
                      setIsFormOpen(false);
                    }
                  }}
                  onCancelEdit={() => handleFormOpenChange(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
