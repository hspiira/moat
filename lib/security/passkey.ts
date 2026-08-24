type PrfInputs = { prf?: { eval?: { first: BufferSource } } };
type PrfOutputs = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

/** Said without naming the extension, which means nothing to the person reading it. */
export const NO_BIOMETRIC_KEY =
  "This device can check your face but cannot use it to unlock your records. Use a PIN instead.";

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
    throw new Error(NO_BIOMETRIC_KEY);
  }
  return first;
}

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

  // Asked here rather than after the round trip, so setup fails before it looks
  // like it worked.
  const created = credential.getClientExtensionResults() as PrfOutputs;
  if (created.prf?.enabled === false) {
    throw new Error(NO_BIOMETRIC_KEY);
  }

  const credentialId = bufferToBase64Url(credential.rawId);
  const prfSalt = randomBytes(32);
  const prfOutput = await evaluatePrf(credentialId, prfSalt);
  return { credentialId, prfSalt, prfOutput };
}

export async function getPasskeyPrfOutput(
  credentialId: string,
  prfSalt: Uint8Array,
): Promise<ArrayBuffer> {
  return evaluatePrf(credentialId, prfSalt);
}
