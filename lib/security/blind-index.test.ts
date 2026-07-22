import { afterEach, describe, expect, it } from "vitest";

import {
  blindIndexValue,
  encryptRecordForStorage,
  indexQueryKey,
  setActiveRecordCryptoKey,
} from "@/lib/security/record-crypto";

async function extractableKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

afterEach(() => {
  setActiveRecordCryptoKey(null);
});

describe("blind index", () => {
  it("is deterministic for the same key, namespace, and value", async () => {
    setActiveRecordCryptoKey(await extractableKey());
    const a = await blindIndexValue("accounts:userId", "user:1");
    const b = await blindIndexValue("accounts:userId", "user:1");
    expect(a).toBe(b);
  });

  it("namespaces values so the same literal differs across fields", async () => {
    setActiveRecordCryptoKey(await extractableKey());
    const asUser = await blindIndexValue("accounts:userId", "shared");
    const asStatus = await blindIndexValue("syncOutbox:status", "shared");
    expect(asUser).not.toBe(asStatus);
  });

  it("produces different hashes under different keys (bound to the DEK)", async () => {
    setActiveRecordCryptoKey(await extractableKey());
    const first = await blindIndexValue("accounts:userId", "user:1");

    setActiveRecordCryptoKey(await extractableKey());
    const second = await blindIndexValue("accounts:userId", "user:1");
    expect(first).not.toBe(second);
  });

  it("matches the stored envelope value so blinded queries find records", async () => {
    setActiveRecordCryptoKey(await extractableKey());

    const stored = (await encryptRecordForStorage("accounts", {
      id: "account:1",
      userId: "user:1",
      name: "Wallet",
    })) as Record<string, unknown>;

    const query = await indexQueryKey("accounts", ["userId"], ["user:1"]);
    expect(stored.userId).toBe(query);
  });

  it("matches the transaction month key (occurredOn stored as blinded month)", async () => {
    setActiveRecordCryptoKey(await extractableKey());

    const stored = (await encryptRecordForStorage("transactions", {
      id: "transaction:1",
      userId: "user:1",
      occurredOn: "2026-04-07",
      amount: 1200,
    })) as Record<string, unknown>;

    const query = await indexQueryKey("transactions", ["userId", "occurredOn"], [
      "user:1",
      "2026-04",
    ]);
    expect([stored.userId, stored.occurredOn]).toEqual(query);
  });

  it("returns raw values when no key is active (plaintext mode)", async () => {
    const single = await indexQueryKey("accounts", ["userId"], ["user:1"]);
    expect(single).toBe("user:1");

    const composite = await indexQueryKey("budgets", ["userId", "month"], ["user:1", "2026-04"]);
    expect(composite).toEqual(["user:1", "2026-04"]);
  });
});
