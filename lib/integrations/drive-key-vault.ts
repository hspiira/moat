import type { GoogleDriveBackupClient } from "@/lib/integrations/google-drive-backup";
import type { PasskeyKeyMaterial } from "@/lib/security/key-hierarchy";
import {
  createKeyVault,
  parseKeyVault,
  serializeKeyVault,
  withPasskeyMaterial,
  withoutPasskey,
  type KeyVault,
} from "@/lib/security/key-vault";

export async function loadKeyVaultFromDrive(
  client: Pick<GoogleDriveBackupClient, "loadKeyVault">,
): Promise<KeyVault | null> {
  const text = await client.loadKeyVault();
  return text === null ? null : parseKeyVault(text);
}

export async function publishKeyVaultToDrive(params: {
  client: Pick<GoogleDriveBackupClient, "saveKeyVault">;
  dek: CryptoKey;
  userId: string;
  passphrase: string;
  passkey?: PasskeyKeyMaterial | null;
  now?: Date;
}): Promise<KeyVault> {
  const passphraseOnly = await createKeyVault({
    dek: params.dek,
    userId: params.userId,
    passphrase: params.passphrase,
    now: params.now,
  });

  const vault = params.passkey
    ? withPasskeyMaterial(passphraseOnly, params.passkey, params.now)
    : passphraseOnly;

  await params.client.saveKeyVault(serializeKeyVault(vault));
  return vault;
}

// A passkey enrolled after the vault was published, or removed after it, has to
// reach Drive or the next device gets the wrong answer about how to open it.
// Neither case needs the recovery passphrase: the passphrase wrap is untouched.
export async function updateVaultPasskey(params: {
  client: Pick<GoogleDriveBackupClient, "loadKeyVault" | "saveKeyVault">;
  passkey: PasskeyKeyMaterial | null;
  now?: Date;
}): Promise<KeyVault | null> {
  const vault = await loadKeyVaultFromDrive(params.client);
  if (!vault) {
    return null;
  }

  const next = params.passkey
    ? withPasskeyMaterial(vault, params.passkey, params.now)
    : withoutPasskey(vault, params.now);

  await params.client.saveKeyVault(serializeKeyVault(next));
  return next;
}

export async function removeVaultFromDrive(
  client: Pick<GoogleDriveBackupClient, "listKeyVaults" | "deleteFile">,
): Promise<number> {
  const vaults = await client.listKeyVaults();
  for (const vault of vaults) {
    await client.deleteFile(vault.fileId);
  }
  return vaults.length;
}

// Two devices that each published a first vault leave two files with the same
// name and different keys. Keeping the newest is a guess, so the user is told
// and asked, rather than one being picked silently.
export async function keepNewestVaultOnly(
  client: Pick<GoogleDriveBackupClient, "listKeyVaults" | "deleteFile">,
): Promise<number> {
  const [, ...older] = await client.listKeyVaults();
  for (const vault of older) {
    await client.deleteFile(vault.fileId);
  }
  return older.length;
}
