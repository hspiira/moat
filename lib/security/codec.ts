/**
 * Byte-array <-> base64 conversion, shared by the security modules that
 * persist binary crypto material (salts, IVs, ciphertext, wrapped keys) as
 * JSON-safe strings.
 *
 * Uses an explicit loop rather than `String.fromCharCode(...bytes)` — the
 * spread form throws `RangeError: Maximum call stack size exceeded` once the
 * byte array is large enough (e.g. encrypted backups), because it passes
 * every byte as an individual function argument.
 */

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
