"use client";

import { useSearchParams } from "next/navigation";

import { AccountLedgerWorkspace } from "./account-ledger-workspace";

/** Reads the account id off the query string for the statically exported page. */
export function AccountLedgerLoader() {
  const accountId = useSearchParams().get("id") ?? "";

  return <AccountLedgerWorkspace accountId={accountId} />;
}
