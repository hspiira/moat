/**
 * PIN-based encryption using Web Crypto API.
 *
 * Key derivation: PBKDF2 with SHA-256, 310,000 iterations (OWASP 2023 recommendation).
 * Encryption: AES-GCM 256-bit. Each encrypt call generates a fresh random IV.
 *
 * The derived CryptoKey is never exported — it lives in memory only and is cleared
 * when the session lock function is called.
 */

import { base64ToBytes, bytesToBase64 } from "@/lib/security/codec";

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_LENGTH_BITS = 256;

export type EncryptedPayload = {
  /** Base64-encoded salt used during key derivation */
  salt: string;
  /** Base64-encoded AES-GCM initialisation vector */
  iv: string;
  /** Base64-encoded ciphertext */
  ciphertext: string;
};

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a JSON-serialisable value with a PIN.
 * Returns an EncryptedPayload that can be JSON-serialised and stored or downloaded.
 */
export async function encryptWithPin<T>(value: T, pin: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(pin, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt an EncryptedPayload produced by encryptWithPin.
 * Throws if the PIN is wrong (AES-GCM authentication tag mismatch).
 */
export async function decryptWithPin<T>(payload: EncryptedPayload, pin: string): Promise<T> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  const key = await deriveKey(pin, salt);

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/**
 * Verify a PIN against a stored EncryptedPayload without caring about the decrypted value.
 * Returns true if the PIN successfully decrypts the payload.
 */
export async function verifyPin(payload: EncryptedPayload, pin: string): Promise<boolean> {
  try {
    await decryptWithPin(payload, pin);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive a session key from a PIN + salt.
 * Used to gate the session — the caller holds the CryptoKey in memory
 * and discards it on lock/logout.
 */
export async function deriveSessionKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  return deriveKey(pin, salt);
}

/**
 * Re-derive the legacy PBKDF2 key as raw bytes so it can be adopted as the
 * DEK during migration to the Argon2id key hierarchy. The bytes are identical
 * to the old non-extractable session key, so existing records stay readable
 * without re-encryption.
 */
export async function deriveLegacyKeyBytes(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}
