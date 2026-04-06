"use client";

import { startTransition, useEffect, useState } from "react";

import { normalizeOpeningBalance, reconcileAccountBalances } from "@/lib/domain/accounts";
import { announceLocalSave } from "@/lib/local-save";
import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { Account, AccountType, Transaction } from "@/lib/types";

import { defaultAccountForm, type AccountFormState } from "./account-form";

const repositories = createIndexedDbRepositories();

function toInstitutionType(type: AccountType): Account["institutionType"] {
  if (type === "bank") return "bank";
  if (type === "mobile_money") return "mobile_money";
  if (type === "sacco") return "sacco";
  return "other";
}

export function useAccountsWorkspace() {
  const [profile, setProfile] = useState<{ id: string } | null>(null);
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
        isArchived: false,
        createdAt: accounts.find((account) => account.id === accountId)?.createdAt ?? timestamp,
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
    lastSavedAt,
    successMessage,
    setAccountForm,
    handleAccountSubmit,
    handleRepairAccounts,
    beginAccountEdit,
    cancelEdit,
  };
}
