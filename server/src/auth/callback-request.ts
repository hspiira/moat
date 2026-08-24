import { isIosRedirect, type GoogleClientKind } from "./google-clients.js";

export type AuthCallbackRequest = {
  provider: "google";
  client: GoogleClientKind;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
  proposedUserId?: string;
};

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Sign-in request is missing ${field}.`);
  }
  return value.trim();
}

// The redirect uri is echoed to the provider, so it is checked against what the
// deployment allows rather than taken on trust from the caller. The app's own
// redirect is a scheme rather than an address, and its shape is fixed by the
// client id, so it is checked against that instead of a list someone maintains.
export function allowedRedirectUris(): string[] {
  return (process.env.MOAT_OIDC_REDIRECT_URIS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function validateAuthCallbackRequest(
  body: unknown,
  allowed: string[],
  iosClientId?: string,
): AuthCallbackRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Sign-in request must be an object.");
  }

  const input = body as Record<string, unknown>;

  if (input.provider !== "google") {
    throw new Error("That sign-in provider is not supported.");
  }

  if (input.client !== undefined && input.client !== "web" && input.client !== "ios") {
    throw new Error("That sign-in client is not supported.");
  }
  const client: GoogleClientKind = input.client === "ios" ? "ios" : "web";

  const redirectUri = readString(input.redirectUri, "redirectUri");
  const permitted =
    client === "ios"
      ? Boolean(iosClientId) && isIosRedirect(redirectUri, iosClientId as string)
      : allowed.includes(redirectUri);
  if (!permitted) {
    throw new Error("That redirect address is not allowed for this deployment.");
  }

  const proposedUserId =
    typeof input.proposedUserId === "string" && input.proposedUserId.trim()
      ? input.proposedUserId.trim()
      : undefined;

  return {
    provider: "google",
    client,
    code: readString(input.code, "code"),
    codeVerifier: readString(input.codeVerifier, "codeVerifier"),
    redirectUri,
    nonce: readString(input.nonce, "nonce"),
    proposedUserId,
  };
}
