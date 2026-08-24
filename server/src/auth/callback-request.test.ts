import { describe, expect, it } from "vitest";

import { validateAuthCallbackRequest } from "./callback-request.js";

const ALLOWED = ["https://moat.example.com/auth/callback"];

function body(overrides: Record<string, unknown> = {}) {
  return {
    provider: "google",
    code: "auth-code",
    codeVerifier: "verifier",
    redirectUri: ALLOWED[0],
    nonce: "nonce-1",
    ...overrides,
  };
}

describe("validateAuthCallbackRequest", () => {
  it("reads a complete request", () => {
    expect(validateAuthCallbackRequest(body(), ALLOWED)).toMatchObject({
      provider: "google",
      code: "auth-code",
      nonce: "nonce-1",
    });
  });

  /* The address is echoed to the provider, so a caller choosing it freely could
     have the code sent somewhere it controls. */
  it("refuses a redirect address the deployment does not allow", () => {
    expect(() =>
      validateAuthCallbackRequest(body({ redirectUri: "https://evil.example.com/steal" }), ALLOWED),
    ).toThrow(/not allowed for this deployment/);
  });

  it("refuses every address when none are configured", () => {
    expect(() => validateAuthCallbackRequest(body(), [])).toThrow(/not allowed/);
  });

  it("refuses a provider it does not support", () => {
    expect(() => validateAuthCallbackRequest(body({ provider: "apple" }), ALLOWED)).toThrow(
      /not supported/,
    );
  });

  it.each(["code", "codeVerifier", "nonce"])("refuses a request with no %s", (field) => {
    expect(() => validateAuthCallbackRequest(body({ [field]: "  " }), ALLOWED)).toThrow(
      new RegExp(`missing ${field}`),
    );
  });

  it("refuses something that is not an object at all", () => {
    expect(() => validateAuthCallbackRequest("google", ALLOWED)).toThrow(/must be an object/);
  });

  it("carries a proposed ledger id through, trimmed", () => {
    expect(
      validateAuthCallbackRequest(body({ proposedUserId: "  user:mine  " }), ALLOWED)
        .proposedUserId,
    ).toBe("user:mine");
  });

  it("treats a blank proposed id as none", () => {
    expect(
      validateAuthCallbackRequest(body({ proposedUserId: "   " }), ALLOWED).proposedUserId,
    ).toBeUndefined();
  });
});
