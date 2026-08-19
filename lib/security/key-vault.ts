import {
  createPasskeyKeyMaterial,
  createPinKeyMaterial,
  unwrapDekWithPin,
  unwrapDekWithPrf,
  type Argon2Params,
  type PasskeyKeyMaterial,
  type PinKeyMaterial,
} from "@/lib/security/key-hierarchy";

export const KEY_VAULT_VERSION = 1;
export const KEY_VAULT_FILENAME = "moat-key-vault.json";
export const MIN_RECOVERY_PASSPHRASE_LENGTH = 12;

// The PIN's parameters are sized for a secret that is protected by a local
// lockout counter. This one is protected by nothing: anyone holding the Drive
// file can attack it offline, for as long as they like.
export const VAULT_ARGON2_PARAMS: Argon2Params = {
  algorithm: "argon2id",
  timeCost: 4,
  memoryCostKib: 65_536, // 64 MiB
  parallelism: 1,
  hashLengthBytes: 32,
};

export const RECOVERY_PASSPHRASE_REQUIREMENT =
  `Use at least ${MIN_RECOVERY_PASSPHRASE_LENGTH} characters, and not only digits. ` +
  "This is not your unlock PIN.";

// A passphrase typed on one device has to match one typed on another, where the
// keyboard may compose accents differently or add a trailing space. Both ends
// normalize, so what is compared is what the user meant to type.
export function normalizeRecoveryPassphrase(passphrase: string): string {
  return passphrase.normalize("NFKC").trim();
}

export type KeyVault = {
  version: number;
  userId: string;
  updatedAt: string;
  passphrase: PinKeyMaterial;
  passkey?: PasskeyKeyMaterial;
};

export class KeyVaultError extends Error {}

export function isValidRecoveryPassphrase(value: string): boolean {
  const normalized = normalizeRecoveryPassphrase(value);
  return normalized.length >= MIN_RECOVERY_PASSPHRASE_LENGTH && !/^\d+$/.test(normalized);
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
    passphrase: await createPinKeyMaterial(
      normalizeRecoveryPassphrase(params.passphrase),
      params.dek,
      VAULT_ARGON2_PARAMS,
    ),
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

// The device's own passkey material already wraps this same DEK under a KEK
// derived from the PRF output, and a platform-synced passkey reproduces that
// output elsewhere. Copying it is what makes the wrap portable, and it spares
// the user a second biometric prompt for a value we already hold.
export function withPasskeyMaterial(
  vault: KeyVault,
  passkey: PasskeyKeyMaterial,
  now: Date = new Date(),
): KeyVault {
  return { ...vault, updatedAt: now.toISOString(), passkey };
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
    return await unwrapDekWithPin(normalizeRecoveryPassphrase(passphrase), vault.passphrase);
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
