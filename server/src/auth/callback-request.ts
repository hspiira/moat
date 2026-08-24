export type AuthCallbackRequest = {
  provider: "google";
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
// deployment allows rather than taken on trust from the caller.
export function allowedRedirectUris(): string[] {
  return (process.env.MOAT_OIDC_REDIRECT_URIS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function validateAuthCallbackRequest(
  body: unknown,
  allowed: string[],
): AuthCallbackRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Sign-in request must be an object.");
  }

  const input = body as Record<string, unknown>;

  if (input.provider !== "google") {
    throw new Error("That sign-in provider is not supported.");
  }

  const redirectUri = readString(input.redirectUri, "redirectUri");
  if (!allowed.includes(redirectUri)) {
    throw new Error("That redirect address is not allowed for this deployment.");
  }

  const proposedUserId =
    typeof input.proposedUserId === "string" && input.proposedUserId.trim()
      ? input.proposedUserId.trim()
      : undefined;

  return {
    provider: "google",
    code: readString(input.code, "code"),
    codeVerifier: readString(input.codeVerifier, "codeVerifier"),
    redirectUri,
    nonce: readString(input.nonce, "nonce"),
    proposedUserId,
  };
}
