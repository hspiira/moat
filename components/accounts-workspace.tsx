"use client";

import { defaultAccountTypes } from "@/lib/app-state/defaults";
import { getAccountTotals } from "@/lib/domain/accounts";
import { MetricChip } from "@/components/page-shell/metric-chip";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import { Money } from "@/components/ui/money";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  AccountForm,
} from "./accounts/account-form";
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

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Accounts"
        description="Manage the accounts where you hold and move money."
        aside={
          accounts.length > 0 ? (
            <MetricChip value={accountTotals.activeAccounts} label="Active accounts" />
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
            <CardContent className="grid gap-6 px-5 py-5 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end sm:px-6">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Total balance
                </p>
                <div className="font-display text-3xl leading-none font-semibold tracking-tight">
                  <Money
                    amount={accountTotals.totalBalance}
                    tone={accountTotals.totalBalance < 0 ? "negative" : "neutral"}
                    className="font-display"
                  />
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Active accounts</p>
                <p className="text-2xl font-semibold tabular-nums">{accountTotals.activeAccounts}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Account types set up</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {
                    defaultAccountTypes.filter(
                      (type) => accountTotals.accountsByType[type] > 0,
                    ).length
                  }
                  <span className="text-base text-muted-foreground"> / {defaultAccountTypes.length}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <AccountForm
              accountTypes={defaultAccountTypes}
              form={accountForm}
              editingId={editingAccountId}
              isSubmitting={isSubmitting}
              lastSavedAt={lastSavedAt}
              successMessage={successMessage}
              onFormChange={setAccountForm}
              onSubmit={(e) => void handleAccountSubmit(e)}
              onCancelEdit={cancelEdit}
            />

            <AccountList accounts={accounts} transactions={transactions} onEdit={beginAccountEdit} />
          </div>

          <DebtPayoffPlanner accounts={accounts} transactions={transactions} />
        </>
      ) : null}
    </div>
  );
}
