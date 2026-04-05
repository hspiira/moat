"use client";

import { startTransition, useEffect, useState } from "react";

import { createBootstrapState } from "@/lib/app-state/bootstrap";
import { defaultAccountTypes } from "@/lib/app-state/defaults";
import { getAccountTotals } from "@/lib/domain/accounts";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type {
  Account,
  AccountType,
  IncomeType,
  RiskComfort,
  SalaryCycle,
  UserProfile,
} from "@/lib/types";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const repositories = createIndexedDbRepositories();

type AccountFormState = {
  id?: string;
  name: string;
  type: AccountType;
  institutionName: string;
  openingBalance: string;
  notes: string;
};

const defaultAccountForm: AccountFormState = {
  name: "",
  type: "cash",
  institutionName: "",
  openingBalance: "0",
  notes: "",
};

function buildTimestamp() {
  return new Date().toISOString();
}

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

const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  bank: "Bank Account",
  sacco: "SACCO",
  investment: "Investment",
  debt: "Debt / Obligation",
};

export function AccountsWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountForm, setAccountForm] = useState<AccountFormState>(defaultAccountForm);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace() {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await repositories.userProfile.get();
      setProfile(nextProfile);

      if (nextProfile) {
        const nextAccounts = await repositories.accounts.listByUser(nextProfile.id);
        setAccounts(nextAccounts);
      } else {
        setAccounts([]);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load accounts.",
      );
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
      const timestamp = buildTimestamp();
      const accountId = editingAccountId ?? `account:${crypto.randomUUID()}`;
      const openingBalance = Number(accountForm.openingBalance);

      const nextAccount: Account = {
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
      };

      await repositories.accounts.upsert(nextAccount);
      setAccountForm(defaultAccountForm);
      setEditingAccountId(null);
      await loadWorkspace();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginAccountEdit(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      id: account.id,
      name: account.name,
      type: account.type,
      institutionName: account.institutionName ?? "",
      openingBalance: String(account.balance),
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-border/40 shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Total balance</CardDescription>
                <CardTitle className="text-xl">
                  {formatCurrency(accountTotals.totalBalance)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/40 shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Active accounts</CardDescription>
                <CardTitle className="text-xl">{accountTotals.activeAccounts}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/40 shadow-none">
              <CardHeader className="pb-2">
                <CardDescription>Account types set up</CardDescription>
                <CardTitle className="text-xl">
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

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/40 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">
                  {editingAccountId ? "Edit account" : "Add account"}
                </CardTitle>
                <CardDescription>
                  {editingAccountId
                    ? "Update the details for this account."
                    : "Add a new account to track."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={handleAccountSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="account-name">Account name</Label>
                    <Input
                      id="account-name"
                      value={accountForm.name}
                      onChange={(e) =>
                        setAccountForm((c) => ({ ...c, name: e.target.value }))
                      }
                      placeholder="e.g. MTN Mobile Money"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="account-type">Account type</Label>
                    <Select
                      value={accountForm.type}
                      onValueChange={(value) =>
                        setAccountForm((c) => ({ ...c, type: value as AccountType }))
                      }
                    >
                      <SelectTrigger id="account-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {defaultAccountTypes.map((type) => (
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
                      value={accountForm.institutionName}
                      onChange={(e) =>
                        setAccountForm((c) => ({ ...c, institutionName: e.target.value }))
                      }
                      placeholder="Optional — e.g. Stanbic Bank"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="opening-balance">Opening balance (UGX)</Label>
                    <Input
                      id="opening-balance"
                      inputMode="decimal"
                      value={accountForm.openingBalance}
                      onChange={(e) =>
                        setAccountForm((c) => ({ ...c, openingBalance: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="account-notes">Notes</Label>
                    <Textarea
                      id="account-notes"
                      value={accountForm.notes}
                      onChange={(e) =>
                        setAccountForm((c) => ({ ...c, notes: e.target.value }))
                      }
                      placeholder="Optional"
                      className="min-h-20"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isSubmitting} type="submit" size="sm">
                      {isSubmitting
                        ? "Saving..."
                        : editingAccountId
                          ? "Update account"
                          : "Add account"}
                    </Button>
                    {editingAccountId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingAccountId(null);
                          setAccountForm(defaultAccountForm);
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/40 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Your accounts</CardTitle>
                <CardDescription>
                  All accounts reconciled from opening balance and transaction history.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {accounts.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/50 px-4 py-8 text-sm text-muted-foreground">
                    No accounts yet. Add your first account to get started.
                  </div>
                ) : (
                  accounts
                    .filter((a) => !a.isArchived)
                    .map((account) => (
                      <Card
                        key={account.id}
                        className="border-border/40 bg-muted/30 shadow-none"
                      >
                        <CardContent className="px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium text-foreground">
                                {account.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {accountTypeLabels[account.type]}
                                {account.institutionName
                                  ? ` · ${account.institutionName}`
                                  : ""}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => beginAccountEdit(account)}
                            >
                              Edit
                            </Button>
                          </div>
                          <Separator className="my-3" />
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Balance</span>
                            <span className="font-medium tabular-nums">
                              {formatCurrency(account.balance)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
