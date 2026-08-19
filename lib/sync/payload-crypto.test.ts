import { afterEach, describe, expect, it } from "vitest";

import { generateDek } from "@/lib/security/key-hierarchy";
import { setActiveRecordCryptoKey } from "@/lib/security/record-crypto";
import {
  SyncEncryptionError,
  canSealSyncPayloads,
  isSealedSyncPayload,
  openSyncPayload,
  sealSyncPayload,
} from "@/lib/sync/payload-crypto";

const RECORD = JSON.stringify({
  id: "transaction:1",
  payee: "Auntie Grace",
  amount: 250_000,
});

afterEach(() => {
  setActiveRecordCryptoKey(null);
});

async function unlock() {
  setActiveRecordCryptoKey(await generateDek());
}

describe("sync payload sealing", () => {
  it("round-trips a record", async () => {
    await unlock();
    const sealed = await sealSyncPayload(RECORD);

    expect(await openSyncPayload(sealed)).toBe(RECORD);
  });

  it("leaves nothing readable in what goes to the server", async () => {
    await unlock();
    const sealed = await sealSyncPayload(RECORD);

    expect(sealed).not.toContain("Auntie Grace");
    expect(sealed).not.toContain("250000");
    expect(sealed).not.toContain("transaction:1");
  });

  it("uses a fresh nonce every time, so the same record never seals alike", async () => {
    await unlock();
    const first = await sealSyncPayload(RECORD);
    const second = await sealSyncPayload(RECORD);

    expect(first).not.toBe(second);
    expect(await openSyncPayload(second)).toBe(RECORD);
  });

  it("refuses to seal when there is no PIN", async () => {
    await expect(sealSyncPayload(RECORD)).rejects.toBeInstanceOf(SyncEncryptionError);
    expect(canSealSyncPayloads()).toBe(false);
  });

  it("refuses a record that arrives unencrypted", async () => {
    await unlock();

    await expect(openSyncPayload(RECORD)).rejects.toThrow(/arrived unencrypted/);
  });

  it("refuses a record sealed with another key", async () => {
    await unlock();
    const sealed = await sealSyncPayload(RECORD);

    setActiveRecordCryptoKey(await generateDek());
    await expect(openSyncPayload(sealed)).rejects.toThrow(/could not be decrypted/);
  });

  it("refuses a record whose ciphertext was tampered with", async () => {
    await unlock();
    const envelope = JSON.parse(await sealSyncPayload(RECORD)) as { ct: string };
    const flipped = envelope.ct.startsWith("A") ? `B${envelope.ct.slice(1)}` : `A${envelope.ct.slice(1)}`;

    await expect(
      openSyncPayload(JSON.stringify({ ...envelope, ct: flipped })),
    ).rejects.toThrow(/could not be decrypted/);
  });

  it("refuses a format it does not know", async () => {
    await unlock();
    const envelope = JSON.parse(await sealSyncPayload(RECORD)) as Record<string, unknown>;

    await expect(openSyncPayload(JSON.stringify({ ...envelope, v: 99 }))).rejects.toThrow(
      /format 99/,
    );
  });

  it("recognises a sealed payload without needing a key", () => {
    expect(isSealedSyncPayload(RECORD)).toBe(false);
    expect(isSealedSyncPayload('{"v":1,"iv":"a","ct":"b"}')).toBe(true);
  });
});
