"use client";

import { startTransition, useEffect, useState } from "react";

import { defaultAccountTypes } from "@/lib/app-state/defaults";
import { AmountIndicator } from "@/components/amount-indicator";
import {
  getAccountTotals,
  normalizeOpeningBalance,
  reconcileAccountBalances,
} from "@/lib/domain/accounts";
import { announceLocalSave } from "@/lib/local-save";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, AccountType, Transaction } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  AccountForm,
  type AccountFormState,
  defaultAccountForm,
} from "./accounts/account-form";
import { AccountList } from "./accounts/account-list";
import { RepairAccountsPanel } from "./accounts/repair-accounts-panel";

const repositories = createIndexedDbRepositories();

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function toInstitutionType(type: AccountType): Account["institutionType"] {
  if (type === "bank") return "bank";
  if (type === "mobile_money") return "mobile_money";
  if (type === "sacco") return "sacco";
  return "other";
}

export function AccountsWorkspace() {
  const [profile, setProfile] = useState<
    { id: string } | null
  >(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountForm, setAccountForm] = useState<AccountFormState>(defaultAccountForm);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadWorkspace() {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await repositories.userProfile.get();
      setProfile(nextProfile);

      if (nextProfile) {
        const [nextAccounts, nextTransactions] = await Promise.all([
          repositories.accounts.listByUser(nextProfile.id),
          repositories.transactions.listByUser(nextProfile.id),
        ]);
        setAccounts(reconcileAccountBalances(nextAccounts, nextTransactions));
        setTransactions(nextTransactions);
      } else {
        setAccounts([]);
        setTransactions([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load accounts.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, []);

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const accountId = editingAccountId ?? `account:${crypto.randomUUID()}`;
      const openingBalance = normalizeOpeningBalance(
        accountForm.type,
        Number(accountForm.openingBalance),
      );
      const wasEditing = Boolean(editingAccountId);

      await repositories.accounts.upsert({
        id: accountId,
        userId: profile.id,
        name: accountForm.name.trim(),
        type: accountForm.type,
        institutionName: accountForm.institutionName.trim() || undefined,
        institutionType: toInstitutionType(accountForm.type),
        openingBalance,
        balance: openingBalance,
        notes: accountForm.notes.trim() || undefined,
        isArchived: false,
        createdAt: accounts.find((a) => a.id === accountId)?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });

      const message = wasEditing ? "Account updated locally" : "Account saved locally";
      setLastSavedAt(timestamp);
      setSuccessMessage(message);
      announceLocalSave({ entity: "accounts", savedAt: timestamp, message });
      setAccountForm(defaultAccountForm);
      setEditingAccountId(null);
      await loadWorkspace();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRepairAccounts(
    repairs: { accountId: string; openingBalance: number }[],
  ) {
    if (!profile || repairs.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();

      await Promise.all(
        repairs.map(async ({ accountId, openingBalance }) => {
          const existing = accounts.find((account) => account.id === accountId);
          if (!existing) return;

          await repositories.accounts.upsert({
            ...existing,
            openingBalance,
            balance: openingBalance,
            updatedAt: timestamp,
          });
        }),
      );

      const message = "Opening balances repaired locally";
      setLastSavedAt(timestamp);
      setSuccessMessage(message);
      announceLocalSave({ entity: "accounts", savedAt: timestamp, message });
      await loadWorkspace();
    } catch (repairError) {
      setError(repairError instanceof Error ? repairError.message : "Unable to repair accounts.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginAccountEdit(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      type: account.type,
      institutionName: account.institutionName ?? "",
      openingBalance: String(Math.abs(account.openingBalance)),
      notes: account.notes ?? "",
    });
  }

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
                    value={formatCurrency(accountTotals.totalBalance)}
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
              onCancelEdit={() => {
                setEditingAccountId(null);
                setAccountForm(defaultAccountForm);
              }}
            />

            <AccountList accounts={accounts} transactions={transactions} onEdit={beginAccountEdit} />
          </div>
        </>
      ) : null}
    </div>
  );
}
