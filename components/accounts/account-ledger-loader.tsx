"use client";

import { useSearchParams } from "next/navigation";

import { AccountLedgerWorkspace } from "./account-ledger-workspace";

export function AccountLedgerLoader() {
  const accountId = useSearchParams().get("id") ?? "";

  return <AccountLedgerWorkspace accountId={accountId} />;
}
