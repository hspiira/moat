import type { GoogleDriveBackupClient } from "@/lib/integrations/google-drive-backup";
import type { PasskeyKeyMaterial } from "@/lib/security/key-hierarchy";
import {
  createKeyVault,
  parseKeyVault,
  serializeKeyVault,
  withPasskeyMaterial,
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
