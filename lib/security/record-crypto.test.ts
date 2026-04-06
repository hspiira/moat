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

  it("encrypts record payloads while keeping indexed metadata in clear text", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    setActiveRecordCryptoKey(key);

    const stored = await encryptRecordForStorage("transactions", {
      id: "transaction:1",
      userId: "user:1",
      occurredOn: "2026-04-07",
      amount: 1200,
    });

    expect(stored).toMatchObject({
      id: "transaction:1",
      userId: "user:1",
      occurredOn: "2026-04-07",
      __moatEncrypted: true,
    });
    expect(JSON.stringify(stored)).not.toContain("\"amount\":1200");

    await expect(decryptRecordFromStorage(stored)).resolves.toMatchObject({
      amount: 1200,
    });
  });

  it("rejects encrypted reads when the app is locked", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
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
