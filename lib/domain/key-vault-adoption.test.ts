import { describe, expect, it } from "vitest";

import { checkVaultBelongsToLedger } from "@/lib/domain/key-vault-adoption";

describe("adopting a vault's key", () => {
  it("allows a device that has no ledger of its own", () => {
    expect(
      checkVaultBelongsToLedger({
        vaultUserId: "user:ada",
        localUserId: null,
        localRecordCount: 0,
      }).ok,
    ).toBe(true);
  });

  it("allows the same ledger, which is the ordinary second device", () => {
    expect(
      checkVaultBelongsToLedger({
        vaultUserId: "user:ada",
        localUserId: "user:ada",
        localRecordCount: 400,
      }).ok,
    ).toBe(true);
  });

  it("allows a different ledger id when nothing has been entered here yet", () => {
    expect(
      checkVaultBelongsToLedger({
        vaultUserId: "user:ada",
        localUserId: "user:fresh-install",
        localRecordCount: 0,
      }).ok,
    ).toBe(true);
  });

  it("refuses to fold two ledgers that both hold records into one key", () => {
    const result = checkVaultBelongsToLedger({
      vaultUserId: "user:ada",
      localUserId: "user:grace",
      localRecordCount: 12,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("different Moat ledger");
  });
});
