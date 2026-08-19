import {
  createPasskeyKeyMaterial,
  createPinKeyMaterial,
  unwrapDekWithPin,
  unwrapDekWithPrf,
  type PasskeyKeyMaterial,
  type PinKeyMaterial,
} from "@/lib/security/key-hierarchy";

export const KEY_VAULT_VERSION = 1;
export const KEY_VAULT_FILENAME = "moat-key-vault.json";
export const MIN_RECOVERY_PASSPHRASE_LENGTH = 12;

export const RECOVERY_PASSPHRASE_REQUIREMENT =
  `Use at least ${MIN_RECOVERY_PASSPHRASE_LENGTH} characters, and not only digits. ` +
  "This is not your unlock PIN.";

export type KeyVault = {
  version: number;
  userId: string;
  updatedAt: string;
  passphrase: PinKeyMaterial;
  passkey?: PasskeyKeyMaterial;
};

export class KeyVaultError extends Error {}

export function isValidRecoveryPassphrase(value: string): boolean {
  return value.length >= MIN_RECOVERY_PASSPHRASE_LENGTH && !/^\d+$/.test(value);
}

function assertUsablePassphrase(passphrase: string) {
  if (!isValidRecoveryPassphrase(passphrase)) {
    throw new KeyVaultError(RECOVERY_PASSPHRASE_REQUIREMENT);
  }
}

export async function createKeyVault(params: {
  dek: CryptoKey;
  userId: string;
  passphrase: string;
  now?: Date;
}): Promise<KeyVault> {
  assertUsablePassphrase(params.passphrase);

  return {
    version: KEY_VAULT_VERSION,
    userId: params.userId,
    updatedAt: (params.now ?? new Date()).toISOString(),
    passphrase: await createPinKeyMaterial(params.passphrase, params.dek),
  };
}

export async function withPasskey(
  vault: KeyVault,
  params: {
    dek: CryptoKey;
    credentialId: string;
    prfSalt: Uint8Array;
    prfOutput: BufferSource;
    now?: Date;
  },
): Promise<KeyVault> {
  return {
    ...vault,
    updatedAt: (params.now ?? new Date()).toISOString(),
    passkey: await createPasskeyKeyMaterial(
      params.dek,
      params.credentialId,
      params.prfSalt,
      params.prfOutput,
    ),
  };
}

export function withoutPasskey(vault: KeyVault, now: Date = new Date()): KeyVault {
  return {
    version: vault.version,
    userId: vault.userId,
    updatedAt: now.toISOString(),
    passphrase: vault.passphrase,
  };
}

export async function openWithRecoveryPassphrase(
  vault: KeyVault,
  passphrase: string,
): Promise<CryptoKey> {
  try {
    return await unwrapDekWithPin(passphrase, vault.passphrase);
  } catch {
    throw new KeyVaultError("That recovery passphrase does not open this vault.");
  }
}

export async function openWithPasskey(
  vault: KeyVault,
  prfOutput: BufferSource,
): Promise<CryptoKey> {
  if (!vault.passkey) {
    throw new KeyVaultError("No passkey is registered for this account.");
  }

  try {
    return await unwrapDekWithPrf(vault.passkey, prfOutput);
  } catch {
    throw new KeyVaultError("This passkey does not open this vault.");
  }
}

export function serializeKeyVault(vault: KeyVault): string {
  return JSON.stringify(vault);
}

export function parseKeyVault(text: string): KeyVault {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new KeyVaultError("That file is not a Moat key vault.");
  }

  const candidate = parsed as Partial<KeyVault>;

  if (
    typeof candidate?.userId !== "string" ||
    typeof candidate?.updatedAt !== "string" ||
    typeof candidate?.version !== "number" ||
    !candidate?.passphrase
  ) {
    throw new KeyVaultError("That file is not a Moat key vault.");
  }

  if (candidate.version !== KEY_VAULT_VERSION) {
    throw new KeyVaultError(
      `This key vault uses format ${candidate.version}, which this version cannot read.`,
    );
  }

  return {
    version: candidate.version,
    userId: candidate.userId,
    updatedAt: candidate.updatedAt,
    passphrase: candidate.passphrase,
    passkey: candidate.passkey,
  };
}
