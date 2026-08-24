import { createRemoteJWKSet, jwtVerify } from "jose";

import { readGoogleClient, type GoogleClientKind } from "./google-clients.js";
import { readIdTokenClaims, type VerifiedIdentity } from "./id-token-claims.js";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// jose caches the keys and refetches on an unknown kid, so this is created once
// rather than per request.
const googleKeys = createRemoteJWKSet(GOOGLE_JWKS_URL);

export async function exchangeGoogleCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
  client: GoogleClientKind;
}): Promise<VerifiedIdentity> {
  const client = readGoogleClient(params.client);

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
    client_id: client.clientId,
  });
  // Sent only for the web client. Google rejects a secret against a native
  // client, and there is none to send in any case.
  if (client.clientSecret) {
    form.set("client_secret", client.clientSecret);
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
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
    audience: client.clientId,
  });

  // jose has checked the signature, issuer and audience. The claims are read
  // again here because the nonce and the expiry are ours to enforce, and one
  // place that states every rule is easier to keep right than two.
  return readIdTokenClaims({
    claims: payload,
    expectedIssuers: GOOGLE_ISSUERS,
    expectedAudience: client.clientId,
    expectedNonce: params.nonce,
    now: Date.now(),
  });
}
