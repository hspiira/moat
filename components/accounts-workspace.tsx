"use client";

import { defaultAccountTypes } from "@/lib/app-state/defaults";
import { formatMoney } from "@/lib/currency";
import { AmountIndicator } from "@/components/amount-indicator";
import { getAccountTotals } from "@/lib/domain/accounts";
import {
  Card,
  CardContent,
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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Manage the accounts where you hold and move money.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading accounts...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !profile ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Complete onboarding to start adding accounts.{" "}
            <a href="/onboarding" className="underline underline-offset-4 hover:text-foreground">
              Set up your profile
            </a>
          </CardContent>
        </Card>
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
                    tone={accountTotals.totalBalance < 0 ? "negative" : "neutral"}
                    sign={accountTotals.totalBalance < 0 ? "negative" : "none"}
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
