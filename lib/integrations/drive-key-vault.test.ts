import { describe, expect, it, vi } from "vitest";

import { loadKeyVaultFromDrive, publishKeyVaultToDrive } from "@/lib/integrations/drive-key-vault";
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
