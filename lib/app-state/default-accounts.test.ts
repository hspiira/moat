import { describe, expect, it } from "vitest";

import {
  buildDefaultAccounts,
  reconcileDefaultAccounts,
} from "@/lib/app-state/default-accounts";
import { isReservedAccountId, isReservedAccountName } from "@/lib/domain/reserved-accounts";
import { BORROWING_POOL_ACCOUNT_ID } from "@/lib/domain/borrowing";
import { LENDING_POOL_ACCOUNT_ID } from "@/lib/domain/lending";
import type { Account } from "@/lib/types";

const TIMESTAMP = "2026-08-06T00:00:00.000Z";

describe("default accounts", () => {
  it("seeds both directions with a zero balance", () => {
    const seeded = buildDefaultAccounts("user:default", TIMESTAMP);

    expect(seeded.map((account) => account.id)).toEqual([
      LENDING_POOL_ACCOUNT_ID,
      BORROWING_POOL_ACCOUNT_ID,
    ]);
    expect(seeded.every((account) => account.openingBalance === 0)).toBe(true);
    expect(seeded.every((account) => account.balance === 0)).toBe(true);
    expect(seeded.map((account) => account.type)).toEqual(["receivable", "debt"]);
  });

  it("creates nothing once a device already has both pools", () => {
    const stored = buildDefaultAccounts("user:default", TIMESTAMP);

    expect(reconcileDefaultAccounts(stored, "user:default", TIMESTAMP)).toEqual([]);
  });

  it("adds only the pool a device is missing", () => {
    const [lendingPool] = buildDefaultAccounts("user:default", TIMESTAMP);

    const missing = reconcileDefaultAccounts([lendingPool], "user:default", TIMESTAMP);

    expect(missing).toHaveLength(1);
    expect(missing[0].id).toBe(BORROWING_POOL_ACCOUNT_ID);
  });

  it("leaves an archived pool archived instead of resurrecting it", () => {
    const stored = buildDefaultAccounts("user:default", TIMESTAMP).map(
      (account): Account => ({ ...account, isArchived: true }),
    );

    expect(reconcileDefaultAccounts(stored, "user:default", TIMESTAMP)).toEqual([]);
  });

  it("recognises reserved ids and names however they are typed", () => {
    expect(isReservedAccountId(LENDING_POOL_ACCOUNT_ID)).toBe(true);
    expect(isReservedAccountId(BORROWING_POOL_ACCOUNT_ID)).toBe(true);
    expect(isReservedAccountId("account:some-uuid")).toBe(false);

    expect(isReservedAccountName("Money lent out")).toBe(true);
    expect(isReservedAccountName("  money LENT out ")).toBe(true);
    expect(isReservedAccountName("Money borrowed")).toBe(true);
    expect(isReservedAccountName("Loan to Sarah")).toBe(false);
  });
});
