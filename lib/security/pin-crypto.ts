import { base64ToBytes, bytesToBase64 } from "@/lib/security/codec";

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_LENGTH_BITS = 256;

export type EncryptedPayload = {
  salt: string;
  iv: string;
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

export async function decryptWithPin<T>(payload: EncryptedPayload, pin: string): Promise<T> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  const key = await deriveKey(pin, salt);

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export async function verifyPin(payload: EncryptedPayload, pin: string): Promise<boolean> {
  try {
    await decryptWithPin(payload, pin);
    return true;
  } catch {
    return false;
  }
}

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
