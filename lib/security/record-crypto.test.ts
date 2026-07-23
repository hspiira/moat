import { afterEach, describe, expect, it } from "vitest";

import {
  decryptRecordFromStorage,
  encryptRecordForStorage,
  hasActiveRecordCryptoKey,
  setActiveRecordCryptoKey,
} from "@/lib/security/record-crypto";

afterEach(() => {
  setActiveRecordCryptoKey(null);
});

describe("record encryption helpers", () => {
  it("keeps plaintext storage when no record key is active", async () => {
    const entity = { id: "account:1", userId: "user:1", name: "Wallet" };
    await expect(encryptRecordForStorage("accounts", entity)).resolves.toEqual(entity);
    expect(hasActiveRecordCryptoKey()).toBe(false);
  });

  it("encrypts payloads and blinds indexed metadata (no plaintext at rest)", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    setActiveRecordCryptoKey(key);

    const stored = await encryptRecordForStorage("transactions", {
      id: "transaction:1",
      userId: "user:1",
      occurredOn: "2026-04-07",
      amount: 1200,
    });

    // The record id stays clear (it is an opaque uuid, needed as the key path).
    expect(stored).toMatchObject({ id: "transaction:1", __moatEncrypted: true });
    // Index fields are present but blinded — the plaintext values never appear.
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain("user:1");
    expect(serialized).not.toContain("2026-04-07");
    expect(serialized).not.toContain("\"amount\":1200");
    expect(typeof (stored as Record<string, unknown>).userId).toBe("string");
    expect((stored as Record<string, unknown>).userId).not.toBe("user:1");

    await expect(decryptRecordFromStorage(stored)).resolves.toMatchObject({
      userId: "user:1",
      occurredOn: "2026-04-07",
      amount: 1200,
    });
  });

  it("rejects encrypted reads when the app is locked", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    setActiveRecordCryptoKey(key);

    const stored = await encryptRecordForStorage("accounts", {
      id: "account:1",
      userId: "user:1",
      name: "Wallet",
    });

    setActiveRecordCryptoKey(null);
    await expect(decryptRecordFromStorage(stored)).rejects.toThrow("Moat is locked");
  });
});
