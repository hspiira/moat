import { describe, expect, it, vi } from "vitest";

import { completeGoogleSignIn } from "@/lib/sync/sign-in";

const BASE = {
  endpoint: "https://sync.example.com",
  code: "auth-code",
  codeVerifier: "verifier",
  redirectUri: "https://moat.example.com/auth/callback",
  nonce: "nonce-1",
};

// Typed arguments so the assertions can read what was actually sent.
function reply(status: number, body: unknown) {
  return vi.fn((...args: [string, RequestInit?]) => {
    void args;
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
}

describe("completeGoogleSignIn", () => {
  it("hands back the token the server minted", async () => {
    vi.stubGlobal(
      "fetch",
      reply(200, { userId: "user:1", isNewUser: true, syncAuthToken: "tok" }),
    );

    expect(await completeGoogleSignIn(BASE)).toEqual({
      status: "ok",
      userId: "user:1",
      isNewUser: true,
      syncAuthToken: "tok",
    });
  });

  it("never sends the verifier anywhere but the sync server", async () => {
    const fetchMock = reply(200, { userId: "u", syncAuthToken: "t" });
    vi.stubGlobal("fetch", fetchMock);

    await completeGoogleSignIn(BASE);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sync.example.com/v1/auth/callback");
    expect(JSON.parse(String(init?.body)).codeVerifier).toBe("verifier");
  });

  /* A ledger already syncing on this device proves it is this device's by
     presenting the token it already holds. Without this an existing account
     could never add Google. */
  it("presents a token it already holds as proof of the ledger", async () => {
    const fetchMock = reply(200, { userId: "u", syncAuthToken: "t" });
    vi.stubGlobal("fetch", fetchMock);

    await completeGoogleSignIn({ ...BASE, proposedUserId: "user:mine", existingAuthToken: "old" });

    const init = fetchMock.mock.calls[0][1];
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer old");
  });

  it("sends no authorization when it holds nothing", async () => {
    const fetchMock = reply(200, { userId: "u", syncAuthToken: "t" });
    vi.stubGlobal("fetch", fetchMock);

    await completeGoogleSignIn(BASE);

    const init = fetchMock.mock.calls[0][1];
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("passes on the server's words when a ledger is already spoken for", async () => {
    vi.stubGlobal(
      "fetch",
      reply(409, { error: "This account is already syncing another Moat ledger." }),
    );

    const result = await completeGoogleSignIn(BASE);

    expect(result).toMatchObject({
      status: "refused",
      message: "This account is already syncing another Moat ledger.",
    });
    // A wall with no way through it is just a dead end.
    expect(result).toHaveProperty("nextStep", expect.stringContaining("restore"));
  });

  it("says something a person can act on when asked to slow down", async () => {
    vi.stubGlobal("fetch", reply(429, {}));

    expect((await completeGoogleSignIn(BASE)).status).toBe("refused");
    vi.stubGlobal("fetch", reply(429, {}));
    expect(await completeGoogleSignIn(BASE)).toMatchObject({
      message: "Too many sign-in attempts. Try again shortly.",
    });
  });

  it("does not treat a broken answer as a sign-in", async () => {
    vi.stubGlobal("fetch", reply(200, { userId: "user:1" }));

    expect((await completeGoogleSignIn(BASE)).status).toBe("refused");
  });
});
