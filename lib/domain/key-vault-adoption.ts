export type LedgerCheck = { ok: true } | { ok: false; reason: string };

// Adopting a vault's key re-seals this device's records under it. That is right
// when both sides are the same ledger, and wrong when they are two ledgers that
// happen to belong to the same person — the plan refuses to merge those.
export function checkVaultBelongsToLedger(params: {
  vaultUserId: string;
  localUserId: string | null;
  localRecordCount: number;
}): LedgerCheck {
  if (!params.localUserId || params.localUserId === params.vaultUserId) {
    return { ok: true };
  }

  if (params.localRecordCount === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      "This recovery file belongs to a different Moat ledger, and this device already has records of its own. Restore that ledger's backup on a device with nothing on it, rather than merging the two.",
  };
}
