import { argon2id } from "hash-wasm";

import { base64ToBytes, bytesToBase64 } from "@/lib/security/codec";

const SALT_BYTES = 16;
const IV_BYTES = 12;
const DEK_BITS = 256;

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

export type WrappedKey = {
  iv: string;
  ciphertext: string;
};

export type PinKeyMaterial = {
  salt: string;
  params: Argon2Params;
  wrappedDek: WrappedKey;
};

export type PasskeyKeyMaterial = {
  credentialId: string; // base64url
  prfSalt: string; // base64; the input to the authenticator's PRF
  wrappedDek: WrappedKey;
};

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

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

async function importKek(kekBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", kekBytes, { name: "AES-GCM" }, false, [
    "wrapKey",
    "unwrapKey",
  ]);
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: DEK_BITS }, true, [
    "encrypt",
    "decrypt",
  ]);
}

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

export async function unwrapDekWithPrf(
  material: PasskeyKeyMaterial,
  prfOutput: BufferSource,
): Promise<CryptoKey> {
  const kek = await deriveKekFromPrf(prfOutput);
  return unwrapDekWithKek(material.wrappedDek, kek);
}
