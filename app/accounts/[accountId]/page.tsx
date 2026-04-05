import { AppShell } from "@/components/app-shell";
import { AccountLedgerWorkspace } from "@/components/accounts/account-ledger-workspace";

export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const decodedAccountId = decodeURIComponent(accountId);

  return (
    <AppShell>
      <AccountLedgerWorkspace accountId={decodedAccountId} />
    </AppShell>
  );
}
