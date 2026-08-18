import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { AccountLedgerLoader } from "@/components/accounts/account-ledger-loader";

export default function AccountLedgerPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <AccountLedgerLoader />
      </Suspense>
    </AppShell>
  );
}
