import { describe, expect, it } from "vitest";

import { generateDek, randomBytes } from "@/lib/security/key-hierarchy";
import {
  KEY_VAULT_VERSION,
  KeyVaultError,
  createKeyVault,
  isValidRecoveryPassphrase,
  openWithPasskey,
  openWithRecoveryPassphrase,
  parseKeyVault,
  serializeKeyVault,
  withPasskey,
  withoutPasskey,
} from "@/lib/security/key-vault";

const PASSPHRASE = "correct horse battery staple";
const NOW = new Date("2026-08-19T09:00:00.000Z");

async function exportKey(key: CryptoKey): Promise<string> {
  return Buffer.from(await crypto.subtle.exportKey("raw", key)).toString("base64");
}

async function buildVault() {
  const dek = await generateDek();
  const vault = await createKeyVault({
    dek,
    userId: "user:ada",
    passphrase: PASSPHRASE,
    now: NOW,
  });
  return { dek, vault };
}

describe("recovery passphrase policy", () => {
  it("refuses anything as short as an unlock PIN", () => {
    expect(isValidRecoveryPassphrase("123456")).toBe(false);
  });

  it("refuses a long string of digits, which is a PIN with extra steps", () => {
    expect(isValidRecoveryPassphrase("1234567890123456")).toBe(false);
  });

  it("accepts a real passphrase", () => {
    expect(isValidRecoveryPassphrase(PASSPHRASE)).toBe(true);
  });

  it("refuses to build a vault the passphrase cannot protect", async () => {
    const dek = await generateDek();

    await expect(
      createKeyVault({ dek, userId: "user:ada", passphrase: "123456" }),
    ).rejects.toBeInstanceOf(KeyVaultError);
  });
});

describe("key vault", () => {
  it("gives back the same key it was built from", async () => {
    const { dek, vault } = await buildVault();

    expect(await exportKey(await openWithRecoveryPassphrase(vault, PASSPHRASE))).toBe(
      await exportKey(dek),
    );
  });

  it("refuses the wrong passphrase", async () => {
    const { vault } = await buildVault();

    await expect(openWithRecoveryPassphrase(vault, "wrong passphrase here")).rejects.toThrow(
      /does not open this vault/,
    );
  });

  it("holds nothing readable without a secret", async () => {
    const { vault } = await buildVault();
    const text = serializeKeyVault(vault);

    expect(text).not.toContain(PASSPHRASE);
    expect(text).toContain("user:ada");
  });

  it("opens with a passkey once one is added", async () => {
    const { dek, vault } = await buildVault();
    const prfOutput = randomBytes(32);

    const withKey = await withPasskey(vault, {
      dek,
      credentialId: "credential:1",
      prfSalt: randomBytes(32),
      prfOutput,
      now: NOW,
    });

    expect(await exportKey(await openWithPasskey(withKey, prfOutput))).toBe(await exportKey(dek));
  });

  it("still opens with the passphrase after a passkey is added", async () => {
    const { dek, vault } = await buildVault();
    const withKey = await withPasskey(vault, {
      dek,
      credentialId: "credential:1",
      prfSalt: randomBytes(32),
      prfOutput: randomBytes(32),
    });

    expect(await exportKey(await openWithRecoveryPassphrase(withKey, PASSPHRASE))).toBe(
      await exportKey(dek),
    );
  });

  it("refuses a passkey that is not the one enrolled", async () => {
    const { dek, vault } = await buildVault();
    const withKey = await withPasskey(vault, {
      dek,
      credentialId: "credential:1",
      prfSalt: randomBytes(32),
      prfOutput: randomBytes(32),
    });

    await expect(openWithPasskey(withKey, randomBytes(32))).rejects.toThrow(
      /does not open this vault/,
    );
  });

  it("says so plainly when no passkey is enrolled", async () => {
    const { vault } = await buildVault();

    await expect(openWithPasskey(vault, randomBytes(32))).rejects.toThrow(/No passkey/);
  });

  it("leaves the passphrase working after a passkey is removed", async () => {
    const { dek, vault } = await buildVault();
    const withKey = await withPasskey(vault, {
      dek,
      credentialId: "credential:1",
      prfSalt: randomBytes(32),
      prfOutput: randomBytes(32),
    });
    const stripped = withoutPasskey(withKey, NOW);

    expect(stripped.passkey).toBeUndefined();
    expect(await exportKey(await openWithRecoveryPassphrase(stripped, PASSPHRASE))).toBe(
      await exportKey(dek),
    );
  });
});

describe("key vault on disk", () => {
  it("survives a round trip through a file", async () => {
    const { dek, vault } = await buildVault();
    const restored = parseKeyVault(serializeKeyVault(vault));

    expect(await exportKey(await openWithRecoveryPassphrase(restored, PASSPHRASE))).toBe(
      await exportKey(dek),
    );
  });

  it("refuses a file that is not a vault", () => {
    expect(() => parseKeyVault('{"hello":"world"}')).toThrow(/not a Moat key vault/);
    expect(() => parseKeyVault("not json at all")).toThrow(/not a Moat key vault/);
  });

  it("refuses a format it does not know", async () => {
    const { vault } = await buildVault();
    const future = JSON.stringify({ ...vault, version: KEY_VAULT_VERSION + 1 });

    expect(() => parseKeyVault(future)).toThrow(/cannot read/);
  });
});
