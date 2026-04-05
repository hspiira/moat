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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const repositories = createIndexedDbRepositories();

type OnboardingFormState = {
  displayName: string;
  salaryCycle: SalaryCycle;
  primaryIncomeType: IncomeType;
  riskComfort: RiskComfort;
  investmentHorizonMonths: string;
};

type AccountFormState = {
  id?: string;
  name: string;
  type: AccountType;
  institutionName: string;
  openingBalance: string;
  notes: string;
};

const defaultOnboardingForm: OnboardingFormState = {
  displayName: "",
  salaryCycle: "month_end",
  primaryIncomeType: "salary",
  riskComfort: "moderate",
  investmentHorizonMonths: "36",
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
  if (type === "bank") {
    return "bank";
  }
  if (type === "mobile_money") {
    return "mobile_money";
  }
  if (type === "sacco") {
    return "sacco";
  }
  return "other";
}

export function AccountsWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [onboardingForm, setOnboardingForm] =
    useState<OnboardingFormState>(defaultOnboardingForm);
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
        loadError instanceof Error
          ? loadError.message
          : "Unable to load account workspace.",
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

  async function handleOnboardingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const timestamp = buildTimestamp();
      const nextProfile: UserProfile = {
        id: "user:default",
        displayName: onboardingForm.displayName.trim(),
        currency: "UGX",
        salaryCycle: onboardingForm.salaryCycle,
        primaryIncomeType: onboardingForm.primaryIncomeType,
        riskComfort: onboardingForm.riskComfort,
        investmentHorizonMonths: Number(onboardingForm.investmentHorizonMonths),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const bootstrapState = createBootstrapState(nextProfile);

      await repositories.userProfile.save(nextProfile);
      await Promise.all(
        bootstrapState.categories.map((category) => repositories.categories.upsert(category)),
      );
      await repositories.investmentProfiles.save(bootstrapState.investmentProfile);
      await repositories.resources.replaceAll(bootstrapState.resources);

      setProfile(nextProfile);
      setOnboardingForm(defaultOnboardingForm);
      await loadWorkspace();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to complete onboarding.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      return;
    }

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
        createdAt:
          accounts.find((account) => account.id === accountId)?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      await repositories.accounts.upsert(nextAccount);

      setAccountForm(defaultAccountForm);
      setEditingAccountId(null);
      await loadWorkspace();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save account.",
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
    <div className="grid gap-6">
      <Card className="border-border/70 bg-background/95 shadow-lg shadow-primary/5">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.85fr] lg:p-8">
          <div className="space-y-4">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              Issue #4
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Onboarding and account setup
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                This route now owns the first real user workflow: create a profile,
                seed the local finance state, and manage the accounts the rest of
                the product will depend on.
              </p>
            </div>
          </div>

          <Card className="border-border/70 bg-muted/35 shadow-none">
            <CardHeader>
              <Badge variant="outline" className="w-fit bg-background/70">
                Implementation boundary
              </Badge>
              <CardTitle>What is live on this route</CardTitle>
              <CardDescription className="leading-7">
                Profile bootstrap, local-first persistence, account creation, and
                account editing are now routed through the repository layer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                <li>Onboarding saves the user profile and bootstrap defaults.</li>
                <li>Accounts persist to IndexedDB through repository contracts.</li>
                <li>The route renders from persisted state instead of placeholder copy.</li>
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-6 py-5 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/70 bg-background/90">
          <CardContent className="px-6 py-10 text-sm text-muted-foreground">
            Loading account workspace...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !profile ? (
        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle>Complete onboarding</CardTitle>
            <CardDescription className="leading-7">
              This creates the local user profile, default categories, starter
              guidance profile, and source catalogue required by later issues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleOnboardingSubmit}>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Display name</span>
                <input
                  className="rounded-lg border border-border bg-background px-3 py-2"
                  value={onboardingForm.displayName}
                  onChange={(event) =>
                    setOnboardingForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium">Salary cycle</span>
                <select
                  className="rounded-lg border border-border bg-background px-3 py-2"
                  value={onboardingForm.salaryCycle}
                  onChange={(event) =>
                    setOnboardingForm((current) => ({
                      ...current,
                      salaryCycle: event.target.value as SalaryCycle,
                    }))
                  }
                >
                  <option value="month_end">Month end</option>
                  <option value="mid_month">Mid month</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium">Primary income type</span>
                <select
                  className="rounded-lg border border-border bg-background px-3 py-2"
                  value={onboardingForm.primaryIncomeType}
                  onChange={(event) =>
                    setOnboardingForm((current) => ({
                      ...current,
                      primaryIncomeType: event.target.value as IncomeType,
                    }))
                  }
                >
                  <option value="salary">Salary</option>
                  <option value="salary_plus_side_income">Salary plus side income</option>
                  <option value="services">Services</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-medium">Risk comfort</span>
                <select
                  className="rounded-lg border border-border bg-background px-3 py-2"
                  value={onboardingForm.riskComfort}
                  onChange={(event) =>
                    setOnboardingForm((current) => ({
                      ...current,
                      riskComfort: event.target.value as RiskComfort,
                    }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm md:col-span-2">
                <span className="font-medium">Investment horizon in months</span>
                <input
                  className="rounded-lg border border-border bg-background px-3 py-2"
                  inputMode="numeric"
                  min="1"
                  value={onboardingForm.investmentHorizonMonths}
                  onChange={(event) =>
                    setOnboardingForm((current) => ({
                      ...current,
                      investmentHorizonMonths: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <div className="md:col-span-2">
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Saving..." : "Create local profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && profile ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardDescription>Profile</CardDescription>
                <CardTitle>{profile.displayName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Salary cycle: {profile.salaryCycle.replaceAll("_", " ")}</div>
                <div>Income type: {profile.primaryIncomeType.replaceAll("_", " ")}</div>
                <div>Risk comfort: {profile.riskComfort}</div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardDescription>Active accounts</CardDescription>
                <CardTitle>{accountTotals.activeAccounts}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Total tracked balance: {formatCurrency(accountTotals.totalBalance)}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardDescription>Setup coverage</CardDescription>
                <CardTitle>{defaultAccountTypes.filter((type) => accountTotals.accountsByType[type] > 0).length} / {defaultAccountTypes.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Accounts created across cash, mobile money, bank, SACCO, investment, and debt.
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>
                  {editingAccountId ? "Edit account" : "Add account"}
                </CardTitle>
                <CardDescription className="leading-7">
                  This form writes directly to the IndexedDB-backed account repository.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={handleAccountSubmit}>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Account name</span>
                    <input
                      className="rounded-lg border border-border bg-background px-3 py-2"
                      value={accountForm.name}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Account type</span>
                    <select
                      className="rounded-lg border border-border bg-background px-3 py-2"
                      value={accountForm.type}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          type: event.target.value as AccountType,
                        }))
                      }
                    >
                      {defaultAccountTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Institution name</span>
                    <input
                      className="rounded-lg border border-border bg-background px-3 py-2"
                      value={accountForm.institutionName}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          institutionName: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Opening balance</span>
                    <input
                      className="rounded-lg border border-border bg-background px-3 py-2"
                      inputMode="decimal"
                      value={accountForm.openingBalance}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          openingBalance: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Notes</span>
                    <textarea
                      className="min-h-24 rounded-lg border border-border bg-background px-3 py-2"
                      value={accountForm.notes}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <Button disabled={isSubmitting} type="submit">
                      {isSubmitting
                        ? "Saving..."
                        : editingAccountId
                          ? "Update account"
                          : "Create account"}
                    </Button>
                    {editingAccountId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingAccountId(null);
                          setAccountForm(defaultAccountForm);
                        }}
                      >
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle>Tracked accounts</CardTitle>
                <CardDescription className="leading-7">
                  Later issues will read from these saved records instead of relying
                  on placeholder route copy.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {accounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-sm text-muted-foreground">
                    No accounts saved yet. Create at least one account to give later
                    transaction and dashboard work real data to target.
                  </div>
                ) : (
                  accounts.map((account) => (
                    <Card key={account.id} className="border-border/70 bg-muted/35 shadow-none">
                      <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-lg">{account.name}</CardTitle>
                            <CardDescription className="leading-6">
                              {account.type.replaceAll("_", " ")}
                              {account.institutionName ? ` • ${account.institutionName}` : ""}
                            </CardDescription>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => beginAccountEdit(account)}
                          >
                            Edit
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                        <div>
                          <div className="font-medium text-foreground">Balance</div>
                          <div>{formatCurrency(account.balance)}</div>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">Opened with</div>
                          <div>{formatCurrency(account.openingBalance)}</div>
                        </div>
                        {account.notes ? (
                          <div className="sm:col-span-2">
                            <Separator className="mb-3" />
                            {account.notes}
                          </div>
                        ) : null}
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
