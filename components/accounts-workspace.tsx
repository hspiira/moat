"use client";

import { defaultAccountTypes } from "@/lib/app-state/defaults";
import { formatMoney } from "@/lib/currency";
import { AmountIndicator } from "@/components/amount-indicator";
import { getAccountTotals } from "@/lib/domain/accounts";
import { MetricChip } from "@/components/page-shell/metric-chip";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
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

          <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr]">
            <Card className="moat-panel-sage border-border/20 shadow-none">
              <CardHeader className="gap-2 p-5">
                <CardDescription className="text-foreground/65">Total balance</CardDescription>
                <CardTitle className="text-4xl tracking-tight">
                  <AmountIndicator
                    tone={
                      accountTotals.totalBalance > 0
                        ? "positive"
                        : accountTotals.totalBalance < 0
                          ? "negative"
                          : "neutral"
                    }
                    sign={
                      accountTotals.totalBalance > 0
                        ? "positive"
                        : accountTotals.totalBalance < 0
                          ? "negative"
                          : "none"
                    }
                    value={formatMoney(accountTotals.totalBalance, "UGX")}
                    className="text-4xl font-semibold tracking-tight"
                  />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="moat-panel-yellow border-border/20 shadow-none">
              <CardHeader className="gap-2 p-5">
                <CardDescription>Active accounts</CardDescription>
                <CardTitle className="text-3xl tracking-tight">
                  {accountTotals.activeAccounts}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="moat-panel-mint border-border/20 shadow-none">
              <CardHeader className="gap-2 p-5">
                <CardDescription>Account types set up</CardDescription>
                <CardTitle className="text-3xl tracking-tight">
                  {
                    defaultAccountTypes.filter(
                      (type) => accountTotals.accountsByType[type] > 0,
                    ).length
                  }{" "}
                  / {defaultAccountTypes.length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

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
