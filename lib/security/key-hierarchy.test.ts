import { describe, expect, it } from "vitest";

import {
  DEFAULT_ARGON2_PARAMS,
  createPasskeyKeyMaterial,
  createPinKeyMaterial,
  generateDek,
  importDekBytes,
  randomBytes,
  unwrapDekWithPin,
  unwrapDekWithPrf,
  verifyPinAgainstMaterial,
  wrapDekWithKek,
} from "@/lib/security/key-hierarchy";

// Keep tests fast: a low-cost Argon2id profile. Production uses the default.
const FAST_PARAMS = {
  ...DEFAULT_ARGON2_PARAMS,
  timeCost: 1,
  memoryCostKib: 8_192,
};

async function exportRaw(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return Buffer.from(raw).toString("hex");
}

describe("key hierarchy", () => {
  it("unwraps the DEK with the correct PIN and returns the same key", async () => {
    const dek = await generateDek();
    const material = await createPinKeyMaterial("123456", dek, FAST_PARAMS);

    const unwrapped = await unwrapDekWithPin("123456", material);
    expect(await exportRaw(unwrapped)).toBe(await exportRaw(dek));
  });

  it("rejects a wrong PIN (auth-tag failure)", async () => {
    const dek = await generateDek();
    const material = await createPinKeyMaterial("123456", dek, FAST_PARAMS);

    await expect(unwrapDekWithPin("999999", material)).rejects.toBeTruthy();
    expect(await verifyPinAgainstMaterial("999999", material)).toBe(false);
    expect(await verifyPinAgainstMaterial("123456", material)).toBe(true);
  });

  it("keeps records readable after a PIN change (DEK unchanged, only re-wrapped)", async () => {
    const dek = await generateDek();
    const first = await createPinKeyMaterial("111111", dek, FAST_PARAMS);

    // Encrypt something with the original DEK.
    const iv = randomBytes(12);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      dek,
      new TextEncoder().encode("secret balance"),
    );

    // Change PIN: re-wrap the SAME dek under new material.
    const unwrapped = await unwrapDekWithPin("111111", first);
    const second = await createPinKeyMaterial("222222", unwrapped, FAST_PARAMS);

    // The new material yields a DEK that still decrypts the old ciphertext.
    const dekAfterChange = await unwrapDekWithPin("222222", second);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      dekAfterChange,
      ciphertext,
    );
    expect(new TextDecoder().decode(plaintext)).toBe("secret balance");
  });

  it("adopts existing key bytes as the DEK (migration path)", async () => {
    const legacyKeyBytes = randomBytes(32);
    const dek = await importDekBytes(legacyKeyBytes);
    const material = await createPinKeyMaterial("654321", dek, FAST_PARAMS);

    const unwrapped = await unwrapDekWithPin("654321", material);
    expect(await exportRaw(unwrapped)).toBe(
      Buffer.from(legacyKeyBytes).toString("hex"),
    );
  });

  it("wraps and unwraps against distinct random material each time", async () => {
    const dek = await generateDek();
    const a = await createPinKeyMaterial("123456", dek, FAST_PARAMS);
    const b = await createPinKeyMaterial("123456", dek, FAST_PARAMS);
    // Same PIN + same DEK still produce different salts and ciphertext.
    expect(a.salt).not.toBe(b.salt);
    expect(a.wrappedDek.ciphertext).not.toBe(b.wrappedDek.ciphertext);
  });
});

describe("passkey (PRF) wrapping", () => {
  it("unwraps the same DEK from the PRF output", async () => {
    const dek = await generateDek();
    const prfOutput = randomBytes(32);
    const salt = randomBytes(32);
    const material = await createPasskeyKeyMaterial(dek, "cred-1", salt, prfOutput);

    const unwrapped = await unwrapDekWithPrf(material, prfOutput);
    expect(await exportRaw(unwrapped)).toBe(await exportRaw(dek));
  });

  it("fails to unwrap with a different PRF output", async () => {
    const dek = await generateDek();
    const material = await createPasskeyKeyMaterial(dek, "cred-1", randomBytes(32), randomBytes(32));
    await expect(unwrapDekWithPrf(material, randomBytes(32))).rejects.toBeTruthy();
  });

  it("wraps the SAME DEK that a PIN wraps, so either method unlocks it", async () => {
    const dek = await generateDek();
    const prfOutput = randomBytes(32);
    const pinMaterial = await createPinKeyMaterial("246810", dek, FAST_PARAMS);
    const passkeyMaterial = await createPasskeyKeyMaterial(dek, "c", randomBytes(32), prfOutput);

    const viaPin = await unwrapDekWithPin("246810", pinMaterial);
    const viaPasskey = await unwrapDekWithPrf(passkeyMaterial, prfOutput);
    expect(await exportRaw(viaPin)).toBe(await exportRaw(viaPasskey));
  });
});

describe("wrapDekWithKek", () => {
  it("produces a fresh IV per wrap", async () => {
    const dek = await generateDek();
    const kek = await crypto.subtle.importKey(
      "raw",
      randomBytes(32),
      { name: "AES-GCM" },
      false,
      ["wrapKey", "unwrapKey"],
    );
    const first = await wrapDekWithKek(dek, kek);
    const second = await wrapDekWithKek(dek, kek);
    expect(first.iv).not.toBe(second.iv);
  });
});
