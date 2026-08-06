"use client";

import { startTransition, useEffect, useState } from "react";

import { normalizeOpeningBalance, reconcileAccountBalances } from "@/lib/domain/accounts";
import {
  isReservedAccountId,
  isReservedAccountName,
  reconcileDefaultAccounts,
} from "@/lib/app-state/default-accounts";
import { canDeleteAccount, planAccountMerge } from "@/lib/domain/account-cleanup";
import { announceLocalSave } from "@/lib/local-save";
import { repositories } from "@/lib/repositories/instance";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { validateAmount } from "@/lib/validation";
import type { Account, AccountType, Transaction } from "@/lib/types";

import { defaultAccountForm, type AccountFormState } from "./account-form";


function toInstitutionType(type: AccountType): Account["institutionType"] {
  if (type === "bank") return "bank";
  if (type === "mobile_money") return "mobile_money";
  if (type === "sacco") return "sacco";
  return "other";
}

export function useAccountsWorkspace() {
  const { show } = useToast();
  const [profile, setProfile] = useState<{ id: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountForm, setAccountForm] = useState<AccountFormState>(defaultAccountForm);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; openingBalance?: string }>({});
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
        const seeds = reconcileDefaultAccounts(
          nextAccounts,
          nextProfile.id,
          new Date().toISOString(),
        );
        if (seeds.length > 0) {
          await Promise.all(seeds.map((account) => repositories.accounts.upsert(account)));
        }
        setAccounts(reconcileAccountBalances([...nextAccounts, ...seeds], nextTransactions));
        setTransactions(nextTransactions);
      } else {
        setAccounts([]);
        setTransactions([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load accounts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, []);

  async function handleAccountSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<boolean> {
    event.preventDefault();
    if (!profile) return false;

    // Debt accounts may carry a negative opening balance (money owed); every
    // other type may not. Zero is always fine.
    const nextFieldErrors: { name?: string; openingBalance?: string } = {};
    if (!accountForm.name.trim()) {
      nextFieldErrors.name = "Give this account a name.";
    } else if (
      isReservedAccountName(accountForm.name) &&
      !isReservedAccountId(editingAccountId ?? "")
    ) {
      nextFieldErrors.name = `Moat already created "${accountForm.name.trim()}" for you. Name this one after the person instead, or record the loan against the existing account.`;
    }
    const balanceError = validateAmount(accountForm.openingBalance || "0", {
      allowZero: true,
      allowNegative: accountForm.type === "debt",
    });
    if (balanceError) {
      nextFieldErrors.openingBalance = balanceError;
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return false;
    }
    setFieldErrors({});

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
      const existing = accounts.find((account) => account.id === accountId);

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
        debtPrincipal:
          accountForm.type === "debt" && accountForm.debtPrincipal
            ? Number(accountForm.debtPrincipal)
            : undefined,
        debtInterestRate:
          accountForm.type === "debt" && accountForm.debtInterestRate
            ? Number(accountForm.debtInterestRate)
            : undefined,
        debtInterestModel:
          accountForm.type === "debt" ? accountForm.debtInterestModel : undefined,
        debtLenderType:
          accountForm.type === "debt" ? accountForm.debtLenderType : undefined,
        debtStartDate:
          accountForm.type === "debt" ? accountForm.debtStartDate : undefined,
        debtTermMonths:
          accountForm.type === "debt" && accountForm.debtTermMonths
            ? Number(accountForm.debtTermMonths)
            : undefined,
        debtRepaymentFrequency:
          accountForm.type === "debt" ? accountForm.debtRepaymentFrequency : undefined,
        isArchived: existing?.isArchived ?? false,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });

      const message = wasEditing ? "Account updated locally" : "Account saved locally";
      setLastSavedAt(timestamp);
      setSuccessMessage(message);
      announceLocalSave({ entity: "accounts", savedAt: timestamp, message });
      show(wasEditing ? "Account updated." : "Account added.", "success");
      setAccountForm(defaultAccountForm);
      setEditingAccountId(null);
      await loadWorkspace();
      return true;
    } catch (submitError) {
      const message = errorMessage(submitError, "Couldn't save the account.");
      setError(message);
      show(message, "error");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function mutate(work: () => Promise<string>, failure: string): Promise<boolean> {
    setIsSubmitting(true);
    setError(null);

    try {
      const message = await work();
      const timestamp = new Date().toISOString();
      setLastSavedAt(timestamp);
      setSuccessMessage(message);
      announceLocalSave({ entity: "accounts", savedAt: timestamp, message });
      show(message, "success");
      await loadWorkspace();
      return true;
    } catch (mutationError) {
      const message = errorMessage(mutationError, failure);
      setError(message);
      show(message, "error");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchiveAccount(accountId: string, isArchived: boolean) {
    const account = accounts.find((entry) => entry.id === accountId);
    if (!account) return false;

    return mutate(async () => {
      await repositories.accounts.upsert({
        ...account,
        isArchived,
        updatedAt: new Date().toISOString(),
      });
      return isArchived ? `${account.name} archived.` : `${account.name} restored.`;
    }, "Couldn't update the account.");
  }

  async function handleDeleteAccount(accountId: string) {
    const account = accounts.find((entry) => entry.id === accountId);
    if (!account) return false;

    return mutate(async () => {
      const verdict = canDeleteAccount(account, transactions);
      if (!verdict.allowed) {
        throw new Error(verdict.reason);
      }
      await repositories.accounts.remove(accountId);
      return `${account.name} deleted.`;
    }, "Couldn't delete the account.");
  }

  async function handleMergeAccount(sourceId: string, targetId: string) {
    const source = accounts.find((entry) => entry.id === sourceId);
    const target = accounts.find((entry) => entry.id === targetId);
    if (!source || !target) return false;

    return mutate(async () => {
      const plan = planAccountMerge(source, target, transactions, new Date().toISOString());
      if (plan.blocked) {
        throw new Error(plan.blocked);
      }

      // The records move first. If this is interrupted the source account is
      // still there holding whatever has not moved yet, which is recoverable;
      // removing it first would orphan them.
      await Promise.all(plan.transactions.map((row) => repositories.transactions.upsert(row)));
      await repositories.accounts.remove(sourceId);

      return `${source.name} merged into ${target.name}.`;
    }, "Couldn't merge the account.");
  }

  async function handleRepairAccounts(repairs: { accountId: string; openingBalance: number }[]) {
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
      debtPrincipal: account.debtPrincipal ? String(account.debtPrincipal) : "",
      debtInterestRate: account.debtInterestRate ? String(account.debtInterestRate) : "",
      debtInterestModel: account.debtInterestModel ?? "reducing_balance",
      debtLenderType: account.debtLenderType ?? "bank",
      debtStartDate: account.debtStartDate ?? new Date().toISOString().slice(0, 10),
      debtTermMonths: account.debtTermMonths ? String(account.debtTermMonths) : "",
      debtRepaymentFrequency: account.debtRepaymentFrequency ?? "monthly",
      notes: account.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingAccountId(null);
    setAccountForm(defaultAccountForm);
  }

  return {
    profile,
    accounts,
    transactions,
    accountForm,
    editingAccountId,
    isLoading,
    isSubmitting,
    error,
    fieldErrors,
    lastSavedAt,
    successMessage,
    setAccountForm,
    handleAccountSubmit,
    handleArchiveAccount,
    handleDeleteAccount,
    handleMergeAccount,
    handleRepairAccounts,
    beginAccountEdit,
    cancelEdit,
  };
}
