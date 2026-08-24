import { createRemoteJWKSet, jwtVerify } from "jose";

import { readIdTokenClaims, type VerifiedIdentity } from "./id-token-claims.js";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// jose caches the keys and refetches on an unknown kid, so this is created once
// rather than per request.
const googleKeys = createRemoteJWKSet(GOOGLE_JWKS_URL);

export function googleClientId(): string {
  const value = process.env.MOAT_OIDC_GOOGLE_CLIENT_ID?.trim();
  if (!value) throw new Error("MOAT_OIDC_GOOGLE_CLIENT_ID is not set.");
  return value;
}

function googleClientSecret(): string {
  const value = process.env.MOAT_OIDC_GOOGLE_CLIENT_SECRET?.trim();
  if (!value) throw new Error("MOAT_OIDC_GOOGLE_CLIENT_SECRET is not set.");
  return value;
}

export async function exchangeGoogleCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
}): Promise<VerifiedIdentity> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
    }),
  });

  if (!response.ok) {
    // The provider's own words can carry the code back to a caller, so they are
    // not passed on.
    throw new Error("Google would not exchange this sign-in code.");
  }

  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string") {
    throw new Error("Google returned no identity token.");
  }

  const { payload } = await jwtVerify(body.id_token, googleKeys, {
    issuer: GOOGLE_ISSUERS,
    audience: googleClientId(),
  });

  // jose has checked the signature, issuer and audience. The claims are read
  // again here because the nonce and the expiry are ours to enforce, and one
  // place that states every rule is easier to keep right than two.
  return readIdTokenClaims({
    claims: payload,
    expectedIssuers: GOOGLE_ISSUERS,
    expectedAudience: googleClientId(),
    expectedNonce: params.nonce,
    now: Date.now(),
  });
}
