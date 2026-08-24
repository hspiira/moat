import { describe, expect, it } from "vitest";

import { iosRedirectScheme, isIosRedirect, readGoogleClient } from "./google-clients.js";

const WEB = {
  MOAT_OIDC_GOOGLE_CLIENT_ID: "web-id.apps.googleusercontent.com",
  MOAT_OIDC_GOOGLE_CLIENT_SECRET: "web-secret",
  MOAT_OIDC_GOOGLE_IOS_CLIENT_ID: "ios-id.apps.googleusercontent.com",
};

describe("readGoogleClient", () => {
  it("gives the web client its secret", () => {
    expect(readGoogleClient("web", WEB)).toEqual({
      kind: "web",
      clientId: "web-id.apps.googleusercontent.com",
      clientSecret: "web-secret",
    });
  });

  /* A native app ships to every phone, so it cannot hold a secret. Google
     issues none for an iOS client and PKCE stands in its place. */
  it("gives the app no secret, because it could not keep one", () => {
    expect(readGoogleClient("ios", WEB)).toEqual({
      kind: "ios",
      clientId: "ios-id.apps.googleusercontent.com",
    });
  });

  it("never hands the web secret to the app client", () => {
    expect(readGoogleClient("ios", WEB).clientSecret).toBeUndefined();
  });

  it("says which variable is missing rather than failing vaguely", () => {
    expect(() => readGoogleClient("ios", {})).toThrow(/MOAT_OIDC_GOOGLE_IOS_CLIENT_ID/);
    expect(() => readGoogleClient("web", {})).toThrow(/MOAT_OIDC_GOOGLE_CLIENT_ID/);
    expect(() =>
      readGoogleClient("web", { MOAT_OIDC_GOOGLE_CLIENT_ID: "x" }),
    ).toThrow(/MOAT_OIDC_GOOGLE_CLIENT_SECRET/);
  });

  /* Borrowing the web id would send the app to a client it holds no secret for,
     and the audience check would then be against the wrong application. */
  it("does not borrow the web client id when the app's own is unset", () => {
    expect(() =>
      readGoogleClient("ios", {
        MOAT_OIDC_GOOGLE_CLIENT_ID: "web-id.apps.googleusercontent.com",
        MOAT_OIDC_GOOGLE_CLIENT_SECRET: "web-secret",
      }),
    ).toThrow(/MOAT_OIDC_GOOGLE_IOS_CLIENT_ID/);
  });

  it("does not treat the two client ids as interchangeable", () => {
    expect(readGoogleClient("web", WEB).clientId).not.toBe(readGoogleClient("ios", WEB).clientId);
  });
});

describe("iosRedirectScheme", () => {
  it("reads the client id backwards, as Google requires", () => {
    expect(iosRedirectScheme("123-abc.apps.googleusercontent.com")).toBe(
      "com.googleusercontent.apps.123-abc",
    );
  });

  it("copes with an id that carries no suffix", () => {
    expect(iosRedirectScheme("123-abc")).toBe("com.googleusercontent.apps.123-abc");
  });
});

describe("isIosRedirect", () => {
  const clientId = "123-abc.apps.googleusercontent.com";

  it("recognises the scheme belonging to this client", () => {
    expect(isIosRedirect("com.googleusercontent.apps.123-abc:/oauth2redirect", clientId)).toBe(
      true,
    );
  });

  /* Another app's scheme would send the code to another app. */
  it("refuses the scheme of a different client", () => {
    expect(isIosRedirect("com.googleusercontent.apps.999-zzz:/oauth2redirect", clientId)).toBe(
      false,
    );
  });

  it("refuses an ordinary web address", () => {
    expect(isIosRedirect("https://moat.example.com/auth/callback", clientId)).toBe(false);
  });
});

describe("reusing the web client for the app", () => {
  it("is refused, because one client cannot be both types", () => {
    expect(() =>
      readGoogleClient("ios", {
        MOAT_OIDC_GOOGLE_IOS_CLIENT_ID: "shared.apps.googleusercontent.com",
        MOAT_OIDC_GOOGLE_CLIENT_ID: "shared.apps.googleusercontent.com",
        MOAT_OIDC_GOOGLE_CLIENT_SECRET: "secret",
      }),
    ).toThrow(/is the web client id/i);
  });

  it("allows the app's own id alongside a different web one", () => {
    expect(
      readGoogleClient("ios", {
        MOAT_OIDC_GOOGLE_IOS_CLIENT_ID: "app.apps.googleusercontent.com",
        MOAT_OIDC_GOOGLE_CLIENT_ID: "web.apps.googleusercontent.com",
      }),
    ).toEqual({ kind: "ios", clientId: "app.apps.googleusercontent.com" });
  });
});
