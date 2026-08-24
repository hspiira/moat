import { describe, expect, it } from "vitest";

import { validateAuthCallbackRequest } from "./callback-request.js";

const ALLOWED = ["https://moat.example.com/auth/callback"];
const IOS_CLIENT = "123-abc.apps.googleusercontent.com";
const IOS_REDIRECT = "com.googleusercontent.apps.123-abc:/oauth2redirect";

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

describe("the app signing in", () => {
  function appBody(overrides: Record<string, unknown> = {}) {
    return {
      provider: "google",
      client: "ios",
      code: "auth-code",
      codeVerifier: "verifier",
      redirectUri: IOS_REDIRECT,
      nonce: "nonce-1",
      ...overrides,
    };
  }

  it("accepts the scheme belonging to the app's own client", () => {
    expect(validateAuthCallbackRequest(appBody(), ALLOWED, IOS_CLIENT)).toMatchObject({
      client: "ios",
      redirectUri: IOS_REDIRECT,
    });
  });

  /* Another app's scheme would have Google deliver the code to that app. */
  it("refuses another app's scheme", () => {
    expect(() =>
      validateAuthCallbackRequest(
        appBody({ redirectUri: "com.googleusercontent.apps.999-zzz:/oauth2redirect" }),
        ALLOWED,
        IOS_CLIENT,
      ),
    ).toThrow(/not allowed for this deployment/);
  });

  it("refuses the app flow when no app client is configured", () => {
    expect(() => validateAuthCallbackRequest(appBody(), ALLOWED, undefined)).toThrow(
      /not allowed for this deployment/,
    );
  });

  /* The web list must not let a scheme through, and the scheme check must not
     let a web address through. */
  it("does not accept a web address as the app's redirect", () => {
    expect(() =>
      validateAuthCallbackRequest(appBody({ redirectUri: ALLOWED[0] }), ALLOWED, IOS_CLIENT),
    ).toThrow(/not allowed for this deployment/);
  });

  it("does not accept the app scheme on the web flow", () => {
    expect(() =>
      validateAuthCallbackRequest(
        appBody({ client: "web", redirectUri: IOS_REDIRECT }),
        ALLOWED,
        IOS_CLIENT,
      ),
    ).toThrow(/not allowed for this deployment/);
  });

  it("treats a request with no client named as the web one", () => {
    expect(
      validateAuthCallbackRequest(
        { ...appBody(), client: undefined, redirectUri: ALLOWED[0] },
        ALLOWED,
        IOS_CLIENT,
      ).client,
    ).toBe("web");
  });

  it("refuses a client it does not know", () => {
    expect(() =>
      validateAuthCallbackRequest(appBody({ client: "android" }), ALLOWED, IOS_CLIENT),
    ).toThrow(/client is not supported/);
  });
});
