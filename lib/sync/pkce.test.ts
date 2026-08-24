import { describe, expect, it } from "vitest";

import {
  codeChallengeFor,
  randomUrlToken,
  readSignInRedirect,
  startGoogleSignIn,
} from "@/lib/sync/pkce";

describe("randomUrlToken", () => {
  it("is safe to put in a url", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(randomUrlToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("is different every time", () => {
    expect(new Set(Array.from({ length: 20 }, () => randomUrlToken())).size).toBe(20);
  });
});

describe("codeChallengeFor", () => {
  /* The known S256 example from RFC 7636, so a change to the encoding cannot
     pass unnoticed. */
  it("matches the challenge the standard gives for a known verifier", async () => {
    expect(await codeChallengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("startGoogleSignIn", () => {
  it("asks for a code, with the challenge and never the verifier", async () => {
    const start = await startGoogleSignIn({
      clientId: "client-1",
      redirectUri: "https://moat.example.com/auth/callback",
    });
    const url = new URL(start.authorizeUrl);

    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await codeChallengeFor(start.verifier));
    expect(start.authorizeUrl).not.toContain(start.verifier);
  });

  it("carries the nonce and state it hands back", async () => {
    const start = await startGoogleSignIn({ clientId: "c", redirectUri: "https://x/y" });
    const url = new URL(start.authorizeUrl);

    expect(url.searchParams.get("nonce")).toBe(start.nonce);
    expect(url.searchParams.get("state")).toBe(start.state);
  });

  it("asks which account, rather than taking whoever is already signed in", async () => {
    const start = await startGoogleSignIn({ clientId: "c", redirectUri: "https://x/y" });

    expect(new URL(start.authorizeUrl).searchParams.get("prompt")).toBe("select_account");
  });

  it("asks for no more than it needs", async () => {
    const start = await startGoogleSignIn({ clientId: "c", redirectUri: "https://x/y" });

    expect(new URL(start.authorizeUrl).searchParams.get("scope")).toBe("openid email");
  });
});

describe("readSignInRedirect", () => {
  it("reads the code and the state", () => {
    expect(readSignInRedirect("?code=abc&state=xyz")).toEqual({ code: "abc", state: "xyz" });
  });

  it("says plainly when the person changed their mind", () => {
    expect(readSignInRedirect("?error=access_denied")).toEqual({
      error: "Sign-in was cancelled.",
    });
  });

  it("does not pass on Google's own words for other failures", () => {
    expect(readSignInRedirect("?error=invalid_scope")).toEqual({
      error: "Google refused the sign-in.",
    });
  });

  it.each(["?code=abc", "?state=xyz", ""])("refuses the incomplete link %s", (search) => {
    expect(readSignInRedirect(search)).toEqual({ error: "That sign-in link is incomplete." });
  });
});
