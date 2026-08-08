import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { AccountLedgerLoader } from "@/components/accounts/account-ledger-loader";

/**
 * The account ledger reads its account from `?id=`, not from a path segment.
 *
 * A static export has to know every route at build time, and account ids are
 * the user's own data — they do not exist when the app is built. As one static
 * page it ships as a real file like every other route, so it works offline
 * whether or not it has been visited before.
 */
export default function AccountLedgerPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <AccountLedgerLoader />
      </Suspense>
    </AppShell>
  );
}
