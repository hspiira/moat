/**
 * Envelope encryption key hierarchy.
 *
 * A single random Data Encryption Key (DEK, AES-GCM-256) encrypts every
 * record. The DEK is wrapped by one or more Key Encryption Keys (KEKs), each
 * derived from an unlock method:
 *   - PIN / passphrase KEK via Argon2id (memory-hard).
 *   - Passkey KEK via WebAuthn PRF (added in a later phase; the wrap format
 *     is shared so it plugs into the same DEK).
 *
 * Changing an unlock method only re-wraps the DEK — records are never
 * re-encrypted. Unlock correctness is proven by AES-GCM unwrap succeeding.
 */

import { argon2id } from "hash-wasm";

const SALT_BYTES = 16;
const IV_BYTES = 12;
const DEK_BITS = 256;

/**
 * Argon2id cost. Memory-hard defaults sized to run in well under a second on
 * a mid-range phone while being far more brute-force-resistant than PBKDF2.
 * Stored alongside the material so the cost can be retuned later without
 * breaking existing wraps.
 */
export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  algorithm: "argon2id",
  timeCost: 3,
  memoryCostKib: 47_104, // 46 MiB
  parallelism: 1,
  hashLengthBytes: 32,
};

export type Argon2Params = {
  algorithm: "argon2id";
  timeCost: number;
  memoryCostKib: number;
  parallelism: number;
  hashLengthBytes: number;
};

/** A DEK wrapped by some KEK (AES-GCM), portable as JSON. */
export type WrappedKey = {
  iv: string;
  ciphertext: string;
};

/** Wrapped-DEK material for the PIN/passphrase unlock method. */
export type PinKeyMaterial = {
  salt: string;
  params: Argon2Params;
  wrappedDek: WrappedKey;
};

/** Wrapped-DEK material for a passkey (WebAuthn PRF) unlock method. */
export type PasskeyKeyMaterial = {
  credentialId: string; // base64url
  prfSalt: string; // base64; the input to the authenticator's PRF
  wrappedDek: WrappedKey;
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Derive raw KEK bytes from a secret (PIN/passphrase) with Argon2id. */
export async function deriveKekBytes(
  secret: string,
  salt: Uint8Array,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<Uint8Array> {
  const hash = await argon2id({
    password: secret,
    salt,
    parallelism: params.parallelism,
    iterations: params.timeCost,
    memorySize: params.memoryCostKib,
    hashLength: params.hashLengthBytes,
    outputType: "binary",
  });
  return hash;
}

/** Import raw KEK bytes as an AES-GCM key usable for wrapping the DEK. */
async function importKek(kekBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", kekBytes, { name: "AES-GCM" }, false, [
    "wrapKey",
    "unwrapKey",
  ]);
}

/**
 * Generate a fresh random DEK. Extractable so it can be wrapped for storage
 * and re-wrapped when unlock methods change; it lives in memory only while
 * unlocked and is never persisted unwrapped.
 */
export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: DEK_BITS }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/** Adopt existing raw key bytes (e.g. a migrated PBKDF2 key) as the DEK. */
export async function importDekBytes(dekBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", dekBytes, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function wrapDekWithKek(dek: CryptoKey, kek: CryptoKey): Promise<WrappedKey> {
  const iv = randomBytes(IV_BYTES);
  const wrapped = await crypto.subtle.wrapKey("raw", dek, kek, { name: "AES-GCM", iv });
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(wrapped)) };
}

export async function unwrapDekWithKek(wrapped: WrappedKey, kek: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    base64ToBytes(wrapped.ciphertext),
    kek,
    { name: "AES-GCM", iv: base64ToBytes(wrapped.iv) },
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Build PIN key material for a brand-new DEK. */
export async function createPinKeyMaterial(
  pin: string,
  dek: CryptoKey,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<PinKeyMaterial> {
  const salt = randomBytes(SALT_BYTES);
  const kek = await importKek(await deriveKekBytes(pin, salt, params));
  const wrappedDek = await wrapDekWithKek(dek, kek);
  return { salt: bytesToBase64(salt), params, wrappedDek };
}

/**
 * Unwrap the DEK from PIN material. Throws if the PIN is wrong (AES-GCM
 * auth-tag failure during unwrap).
 */
export async function unwrapDekWithPin(pin: string, material: PinKeyMaterial): Promise<CryptoKey> {
  const kek = await importKek(
    await deriveKekBytes(pin, base64ToBytes(material.salt), material.params),
  );
  return unwrapDekWithKek(material.wrappedDek, kek);
}

export async function verifyPinAgainstMaterial(
  pin: string,
  material: PinKeyMaterial,
): Promise<boolean> {
  try {
    await unwrapDekWithPin(pin, material);
    return true;
  } catch {
    return false;
  }
}

// --- Passkey (WebAuthn PRF) KEK ---------------------------------------------

/**
 * Derive a KEK from a WebAuthn PRF output via HKDF. The PRF output is a
 * high-entropy secret the authenticator returns for a given salt; HKDF binds
 * it to a fixed context so the same secret can't be reused elsewhere.
 */
export async function deriveKekFromPrf(prfOutput: BufferSource): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", prfOutput, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode("moat/passkey-kek/v1"),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

export async function createPasskeyKeyMaterial(
  dek: CryptoKey,
  credentialId: string,
  prfSalt: Uint8Array,
  prfOutput: BufferSource,
): Promise<PasskeyKeyMaterial> {
  const kek = await deriveKekFromPrf(prfOutput);
  return {
    credentialId,
    prfSalt: bytesToBase64(prfSalt),
    wrappedDek: await wrapDekWithKek(dek, kek),
  };
}

/** Unwrap the DEK from passkey material given the authenticator's PRF output. */
export async function unwrapDekWithPrf(
  material: PasskeyKeyMaterial,
  prfOutput: BufferSource,
): Promise<CryptoKey> {
  const kek = await deriveKekFromPrf(prfOutput);
  return unwrapDekWithKek(material.wrappedDek, kek);
}
