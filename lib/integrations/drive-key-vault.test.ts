import { describe, expect, it, vi } from "vitest";

import {
  keepNewestVaultOnly,
  loadKeyVaultFromDrive,
  publishKeyVaultToDrive,
  removeVaultFromDrive,
  updateVaultPasskey,
} from "@/lib/integrations/drive-key-vault";
import {
  createPasskeyKeyMaterial,
  generateDek,
  randomBytes,
} from "@/lib/security/key-hierarchy";
import {
  KeyVaultError,
  openWithPasskey,
  openWithRecoveryPassphrase,
} from "@/lib/security/key-vault";

const PASSPHRASE = "correct horse battery staple";

async function exportKey(key: CryptoKey): Promise<string> {
  return Buffer.from(await crypto.subtle.exportKey("raw", key)).toString("base64");
}

function createFakeDrive() {
  let stored: string | null = null;
  return {
    saveKeyVault: vi.fn(async (text: string) => {
      stored = text;
      return { fileId: "vault-1" };
    }),
    loadKeyVault: vi.fn(async () => stored),
  };
}

function createFakeVaultFolder(fileIds: string[]) {
  const remaining = [...fileIds];
  return {
    listKeyVaults: vi.fn(async () =>
      remaining.map((fileId, index) => ({
        fileId,
        name: "moat-key-vault.json",
        modifiedTime: `2026-08-${19 - index}T09:00:00.000Z`,
      })),
    ),
    deleteFile: vi.fn(async (fileId: string) => {
      remaining.splice(remaining.indexOf(fileId), 1);
    }),
  };
}

describe("key vault over drive", () => {
  it("hands the same key back on the next device", async () => {
    const drive = createFakeDrive();
    const dek = await generateDek();

    await publishKeyVaultToDrive({
      client: drive,
      dek,
      userId: "user:ada",
      passphrase: PASSPHRASE,
    });

    const fetched = await loadKeyVaultFromDrive(drive);
    expect(fetched?.userId).toBe("user:ada");

    const opened = await openWithRecoveryPassphrase(fetched!, PASSPHRASE);
    expect(await exportKey(opened)).toBe(await exportKey(dek));
  });

  it("carries the passkey wrap so a synced passkey opens it without typing", async () => {
    const drive = createFakeDrive();
    const dek = await generateDek();
    const prfSalt = randomBytes(32);
    const prfOutput = randomBytes(32);
    const passkey = await createPasskeyKeyMaterial(dek, "credential-1", prfSalt, prfOutput);

    await publishKeyVaultToDrive({
      client: drive,
      dek,
      userId: "user:ada",
      passphrase: PASSPHRASE,
      passkey,
    });

    const fetched = await loadKeyVaultFromDrive(drive);
    const opened = await openWithPasskey(fetched!, prfOutput);
    expect(await exportKey(opened)).toBe(await exportKey(dek));
  });

  it("says there is no vault rather than inventing one", async () => {
    const drive = createFakeDrive();
    await expect(loadKeyVaultFromDrive(drive)).resolves.toBeNull();
  });

  it("stores nothing when the passphrase is too weak to protect the key", async () => {
    const drive = createFakeDrive();
    const dek = await generateDek();

    await expect(
      publishKeyVaultToDrive({
        client: drive,
        dek,
        userId: "user:ada",
        passphrase: "123456",
      }),
    ).rejects.toBeInstanceOf(KeyVaultError);

    expect(drive.saveKeyVault).not.toHaveBeenCalled();
  });
});

describe("keeping the vault level with the device", () => {
  it("adds a passkey enrolled after the vault was written", async () => {
    const drive = createFakeDrive();
    const dek = await generateDek();
    const prfSalt = randomBytes(32);
    const prfOutput = randomBytes(32);

    await publishKeyVaultToDrive({
      client: drive,
      dek,
      userId: "user:ada",
      passphrase: PASSPHRASE,
    });

    const passkey = await createPasskeyKeyMaterial(dek, "credential-1", prfSalt, prfOutput);
    await updateVaultPasskey({ client: drive, passkey });

    const fetched = await loadKeyVaultFromDrive(drive);
    expect(await exportKey(await openWithPasskey(fetched!, prfOutput))).toBe(await exportKey(dek));
  });

  it("takes the passkey back out, and leaves the passphrase working", async () => {
    const drive = createFakeDrive();
    const dek = await generateDek();
    const prfOutput = randomBytes(32);
    const passkey = await createPasskeyKeyMaterial(dek, "credential-1", randomBytes(32), prfOutput);

    await publishKeyVaultToDrive({
      client: drive,
      dek,
      userId: "user:ada",
      passphrase: PASSPHRASE,
      passkey,
    });

    await updateVaultPasskey({ client: drive, passkey: null });

    const fetched = await loadKeyVaultFromDrive(drive);
    expect(fetched?.passkey).toBeUndefined();
    await expect(openWithPasskey(fetched!, prfOutput)).rejects.toBeInstanceOf(KeyVaultError);
    expect(await exportKey(await openWithRecoveryPassphrase(fetched!, PASSPHRASE))).toBe(
      await exportKey(dek),
    );
  });

  it("does nothing when there is no vault to update", async () => {
    const drive = createFakeDrive();
    await expect(updateVaultPasskey({ client: drive, passkey: null })).resolves.toBeNull();
    expect(drive.saveKeyVault).not.toHaveBeenCalled();
  });
});

describe("tidying the drive app folder", () => {
  it("removes every vault when the device key is discarded", async () => {
    const folder = createFakeVaultFolder(["vault-1", "vault-2"]);

    await expect(removeVaultFromDrive(folder)).resolves.toBe(2);
    expect(folder.deleteFile).toHaveBeenCalledTimes(2);
  });

  it("keeps only the newest when two devices each wrote one", async () => {
    const folder = createFakeVaultFolder(["vault-newest", "vault-older"]);

    await expect(keepNewestVaultOnly(folder)).resolves.toBe(1);
    expect(folder.deleteFile).toHaveBeenCalledExactlyOnceWith("vault-older");
  });

  it("leaves a single vault alone", async () => {
    const folder = createFakeVaultFolder(["vault-1"]);

    await expect(keepNewestVaultOnly(folder)).resolves.toBe(0);
    expect(folder.deleteFile).not.toHaveBeenCalled();
  });
});
