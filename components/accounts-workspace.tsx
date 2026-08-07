"use client";

import { IconArchive, IconArchiveOff, IconTrash } from "@tabler/icons-react";

import { defaultAccountTypes } from "@/lib/app-state/defaults";
import { canDeleteAccount } from "@/lib/domain/account-cleanup";
import { useConfirmDelete } from "@/components/hooks/use-confirm-delete";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getAccountTotals } from "@/lib/domain/accounts";
import { useFormSheet } from "@/components/hooks/use-form-sheet";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { AccountForm } from "./accounts/account-form";
import { AccountList } from "./accounts/account-list";
import { DuplicateAccountsPanel } from "./accounts/duplicate-accounts-panel";
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
  } = useAccountsWorkspace();

  const accountTotals = getAccountTotals(accounts);

  const formSheet = useFormSheet(cancelEdit);
  const editingAccount = accounts.find((account) => account.id === editingAccountId) ?? null;
  // Accounts were the one thing still deleted on a single tap.
  const confirmDelete = useConfirmDelete<string>(async (accountId) => {
    const ok = await handleDeleteAccount(accountId);
    if (ok) formSheet.close();
  });

  function openAddAccount() {
    formSheet.openForCreate();
  }

  function openEditAccount(account: Parameters<typeof beginAccountEdit>[0]) {
    formSheet.openForEdit(() => beginAccountEdit(account));
  }

  return (
    <div className="grid gap-5">
      <PageHeader title="Accounts" srOnlyTitle />

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
          {/* The total sits bare on the canvas — the number is the hero, and a
              box around it only shrinks it. Actions ride directly beneath. */}
          <section className="space-y-4 pt-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total balance</p>
              <div className="font-display text-[clamp(2.25rem,10vw,3rem)] leading-[1.1] font-semibold tracking-tight">
                <Money
                  amount={accountTotals.totalBalance}
                  tone={accountTotals.totalBalance < 0 ? "negative" : "neutral"}
                  className="font-display"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                across {accountTotals.activeAccounts}{" "}
                {accountTotals.activeAccounts === 1 ? "account" : "accounts"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={openAddAccount} className="flex-1 sm:flex-none sm:px-6">
                Add account
              </Button>
              <Button asChild variant="secondary" className="flex-1 sm:flex-none sm:px-6">
                <Link href="/transactions/import">Import</Link>
              </Button>
            </div>
          </section>

          <DuplicateAccountsPanel
            accounts={accounts}
            transactions={transactions}
            isSubmitting={isSubmitting}
            onMerge={(sourceId, targetId) => void handleMergeAccount(sourceId, targetId)}
          />

          <RepairAccountsPanel
            accounts={accounts}
            transactions={transactions}
            isSubmitting={isSubmitting}
            onRepair={handleRepairAccounts}
          />

          <AccountList
            accounts={accounts}
            transactions={transactions}
            onEdit={openEditAccount}
            onAdd={openAddAccount}
            onArchive={(accountId, isArchived) => void handleArchiveAccount(accountId, isArchived)}
            onDelete={(accountId) =>
              confirmDelete.request(
                accountId,
                accounts.find((account) => account.id === accountId)?.name ?? "This account",
              )
            }
          />

          <Sheet open={formSheet.isOpen} onOpenChange={formSheet.onOpenChange}>
            <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
              {/* The form's own colour band is the visible heading; keep an
                  accessible title for screen readers. */}
              <SheetHeader className="sr-only">
                <SheetTitle>{editingAccountId ? "Edit account" : "Add account"}</SheetTitle>
                <SheetDescription>Add or update an account you hold money in.</SheetDescription>
              </SheetHeader>
              <AccountForm
                embedded
                accountTypes={defaultAccountTypes}
                form={accountForm}
                editingId={editingAccountId}
                isSubmitting={isSubmitting}
                lastSavedAt={lastSavedAt}
                successMessage={successMessage}
                fieldErrors={fieldErrors}
                onFormChange={setAccountForm}
                onSubmit={async (e) => {
                  const ok = await handleAccountSubmit(e);
                  if (ok) {
                    formSheet.close();
                  }
                }}
                onCancelEdit={formSheet.close}
              />

              {editingAccount ? (
                <div className="mt-2 grid gap-2 px-5 pb-5">
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-start text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void handleArchiveAccount(editingAccount.id, !editingAccount.isArchived);
                      formSheet.close();
                    }}
                  >
                    {editingAccount.isArchived ? <IconArchiveOff /> : <IconArchive />}
                    {editingAccount.isArchived ? "Restore from archive" : "Archive account"}
                  </Button>
                  {(() => {
                    const verdict = canDeleteAccount(editingAccount, transactions);
                    return verdict.allowed ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => confirmDelete.request(editingAccount.id, editingAccount.name)}
                      >
                        <IconTrash />
                        Delete account
                      </Button>
                    ) : (
                      <p className="px-3 text-xs text-muted-foreground">{verdict.reason}</p>
                    );
                  })()}
                </div>
              ) : null}
            </SheetContent>
          </Sheet>

          <ConfirmDialog
            {...confirmDelete.dialogProps}
            title="Delete this account?"
            description={`${confirmDelete.label} and its settings will be removed permanently.`}
            confirmLabel="Delete"
          />
        </>
      ) : null}
    </div>
  );
}
