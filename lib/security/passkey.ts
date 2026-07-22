/**
 * WebAuthn passkey unlock using the PRF extension.
 *
 * A platform passkey (Face ID / Touch ID / Android biometric) returns a
 * high-entropy secret via the PRF extension for a given salt. That secret
 * derives a KEK that wraps the same DEK the PIN wraps, so a passkey is an
 * additional unlock method, never a replacement — the PIN always remains as a
 * recoverable fallback.
 *
 * PRF support cannot be fully feature-detected up front; enrollment attempts a
 * real PRF evaluation and fails cleanly if the authenticator doesn't provide it.
 */

// Minimal typings for the PRF extension, which isn't in the DOM lib yet.
type PrfInputs = { prf?: { eval?: { first: BufferSource } } };
type PrfOutputs = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

export type PasskeyEnrollment = {
  credentialId: string;
  prfSalt: Uint8Array;
  prfOutput: ArrayBuffer;
};

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export function isWebAuthnAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

/** True if a platform authenticator (biometric) is present. */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function evaluatePrf(credentialId: string, prfSalt: Uint8Array): Promise<ArrayBuffer> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: window.location.hostname,
      allowCredentials: [
        { type: "public-key", id: base64UrlToBuffer(credentialId), transports: ["internal"] },
      ],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: prfSalt } } } as PrfInputs,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Passkey unlock was cancelled.");
  }
  const results = assertion.getClientExtensionResults() as PrfOutputs;
  const first = results.prf?.results?.first;
  if (!first) {
    throw new Error("This device's passkey does not support PRF-based encryption.");
  }
  return first;
}

/**
 * Create a platform passkey and obtain its PRF output for a fresh salt.
 * Throws if the device lacks platform/PRF support or the user cancels.
 */
export async function registerPasskey(params: {
  userId: string;
  userName: string;
}): Promise<PasskeyEnrollment> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "Moat", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(params.userId),
        name: params.userName,
        displayName: params.userName,
      },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
      },
      timeout: 60_000,
      extensions: { prf: {} } as PrfInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey setup was cancelled.");
  }

  const credentialId = bufferToBase64Url(credential.rawId);
  const prfSalt = randomBytes(32);
  const prfOutput = await evaluatePrf(credentialId, prfSalt);
  return { credentialId, prfSalt, prfOutput };
}

/** Obtain the PRF output for an existing enrolled passkey (used to unlock). */
export async function getPasskeyPrfOutput(
  credentialId: string,
  prfSalt: Uint8Array,
): Promise<ArrayBuffer> {
  return evaluatePrf(credentialId, prfSalt);
}
