import { afterEach, describe, expect, it } from "vitest";

import {
  decryptRecordFromStorage,
  encryptRecordForStorage,
  hasActiveRecordCryptoKey,
  setActiveRecordCryptoKey,
  storesWithRecordMetadata,
} from "@/lib/security/record-crypto";
import {
  USER_ID_INDEX,
  getIndexedDbStoreIndexes,
} from "@/lib/repositories/indexeddb/client";
import { storeNames, type StoreName } from "@/lib/repositories/store-names";

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

    expect(stored).toMatchObject({ id: "transaction:1", __moatEncrypted: true });
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

describe("record metadata covers every store looked up by user", () => {
  it("leaves no store queryable by userId without a metadata entry", () => {
    const byUserId = (Object.values(storeNames) as StoreName[]).filter((store) =>
      getIndexedDbStoreIndexes(store).includes(USER_ID_INDEX),
    );

    const missing = byUserId.filter((store) => !storesWithRecordMetadata.includes(store));

    expect(
      missing,
      "these stores index userId but encrypt it away, so listByUser returns nothing once a PIN is set",
    ).toEqual([]);
  });
});
