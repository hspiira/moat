export type IdTokenClaims = {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
};

export type VerifiedIdentity = {
  issuer: string;
  subject: string;
  email?: string;
};

// Every one of these is a way in if it is skipped. A wrong issuer lets any
// provider vouch for anyone; a wrong audience lets a token minted for another
// app be replayed here; a missing nonce lets a captured token be reused.
export function readIdTokenClaims(params: {
  claims: IdTokenClaims;
  expectedIssuers: string[];
  expectedAudience: string;
  expectedNonce: string;
  now: number;
}): VerifiedIdentity {
  const { claims } = params;

  const issuer = typeof claims.iss === "string" ? claims.iss : "";
  if (!params.expectedIssuers.includes(issuer)) {
    throw new Error("The sign-in token was not issued by a provider this server trusts.");
  }

  const audiences = Array.isArray(claims.aud)
    ? claims.aud.filter((entry): entry is string => typeof entry === "string")
    : typeof claims.aud === "string"
      ? [claims.aud]
      : [];
  if (!audiences.includes(params.expectedAudience)) {
    throw new Error("The sign-in token was issued for a different application.");
  }

  const expiry = typeof claims.exp === "number" ? claims.exp : 0;
  if (expiry * 1000 <= params.now) {
    throw new Error("The sign-in token has expired.");
  }

  if (typeof claims.nonce !== "string" || claims.nonce !== params.expectedNonce) {
    throw new Error("The sign-in token does not match this sign-in attempt.");
  }

  const subject = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!subject) {
    throw new Error("The sign-in token names no account.");
  }

  // Carried for display only. An unverified address must never be shown as if
  // the provider had checked it, and the subject is what identifies a person.
  const email =
    claims.email_verified === true && typeof claims.email === "string" ? claims.email : undefined;

  return { issuer, subject, email };
}
