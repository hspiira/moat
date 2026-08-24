import { describe, expect, it } from "vitest";

import { readIdTokenClaims } from "./id-token-claims.js";

const NOW = Date.UTC(2026, 7, 24, 9, 0, 0);

function read(overrides: Record<string, unknown> = {}) {
  return readIdTokenClaims({
    claims: {
      iss: "https://accounts.google.com",
      aud: "moat-client-id",
      sub: "google-subject-1",
      exp: Math.floor(NOW / 1000) + 600,
      nonce: "nonce-1",
      email: "owner@example.com",
      email_verified: true,
      ...overrides,
    },
    expectedIssuers: ["https://accounts.google.com"],
    expectedAudience: "moat-client-id",
    expectedNonce: "nonce-1",
    now: NOW,
  });
}

describe("readIdTokenClaims", () => {
  it("reads the account out of a token that checks out", () => {
    expect(read()).toEqual({
      issuer: "https://accounts.google.com",
      subject: "google-subject-1",
      email: "owner@example.com",
    });
  });

  it("refuses an issuer it does not trust", () => {
    expect(() => read({ iss: "https://evil.example.com" })).toThrow(/not issued by a provider/);
  });

  it("refuses a token with no issuer at all", () => {
    expect(() => read({ iss: undefined })).toThrow(/not issued by a provider/);
  });

  /* A token minted for another application would otherwise be replayable here. */
  it("refuses a token issued for a different application", () => {
    expect(() => read({ aud: "someone-elses-client" })).toThrow(/different application/);
  });

  it("accepts an audience list that contains this application", () => {
    expect(read({ aud: ["other", "moat-client-id"] }).subject).toBe("google-subject-1");
  });

  it("refuses an audience list that does not", () => {
    expect(() => read({ aud: ["other"] })).toThrow(/different application/);
  });

  it("refuses a token that has expired", () => {
    expect(() => read({ exp: Math.floor(NOW / 1000) - 1 })).toThrow(/expired/);
  });

  it("refuses a token with no expiry", () => {
    expect(() => read({ exp: undefined })).toThrow(/expired/);
  });

  /* Without the nonce a token captured from one sign-in could be replayed to
     start another. */
  it("refuses a token from a different sign-in attempt", () => {
    expect(() => read({ nonce: "nonce-2" })).toThrow(/this sign-in attempt/);
  });

  it("refuses a token carrying no nonce", () => {
    expect(() => read({ nonce: undefined })).toThrow(/this sign-in attempt/);
  });

  it("refuses a token that names no account", () => {
    expect(() => read({ sub: "  " })).toThrow(/names no account/);
  });

  it("leaves out an address the provider has not checked", () => {
    expect(read({ email_verified: false }).email).toBeUndefined();
  });

  it("leaves out an address that is not a string", () => {
    expect(read({ email: 42 }).email).toBeUndefined();
  });
});
