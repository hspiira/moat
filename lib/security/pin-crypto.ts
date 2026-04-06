/**
 * PIN-based encryption using Web Crypto API.
 *
 * Key derivation: PBKDF2 with SHA-256, 310,000 iterations (OWASP 2023 recommendation).
 * Encryption: AES-GCM 256-bit. Each encrypt call generates a fresh random IV.
 *
 * The derived CryptoKey is never exported — it lives in memory only and is cleared
 * when the session lock function is called.
 */

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

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

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
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(ciphertext),
  };
}

/**
 * Decrypt an EncryptedPayload produced by encryptWithPin.
 * Throws if the PIN is wrong (AES-GCM authentication tag mismatch).
 */
export async function decryptWithPin<T>(payload: EncryptedPayload, pin: string): Promise<T> {
  const salt = new Uint8Array(base64ToBuffer(payload.salt));
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

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
