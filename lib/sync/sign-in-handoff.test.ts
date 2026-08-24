import { describe, expect, it } from "vitest";

import {
  matchesAttempt,
  rememberSignInAttempt,
  takeSignInAttempt,
  type SignInAttempt,
} from "@/lib/sync/sign-in-handoff";

function fakeStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    size: () => values.size,
  };
}

const attempt: SignInAttempt = {
  verifier: "verifier",
  nonce: "nonce",
  state: "state-1",
  redirectUri: "https://moat.example.com/auth/callback",
  endpoint: "https://sync.example.com",
  proposedUserId: "user:mine",
  existingAuthToken: "old-token",
  client: "web",
};

describe("the sign-in handoff", () => {
  it("carries every part of the attempt across the redirect", () => {
    const store = fakeStore();
    rememberSignInAttempt(attempt, store);

    expect(takeSignInAttempt(store)).toEqual(attempt);
  });

  /* A verifier left behind is a code someone else could spend, so reading it
     consumes it. */
  /* Which client asked decides which Google application the code is exchanged
     against, so losing it across the redirect would send the app's code to the
     web client and be refused. */
  it("remembers that the app was the one asking", () => {
    const store = fakeStore();
    rememberSignInAttempt({ ...attempt, client: "ios" }, store);

    expect(takeSignInAttempt(store)?.client).toBe("ios");
  });

  it("treats an attempt stored before this existed as the web one", () => {
    const store = fakeStore();
    const older: Record<string, unknown> = { ...attempt };
    delete older.client;
    store.setItem("moat.sign-in-attempt", JSON.stringify(older));

    expect(takeSignInAttempt(store)?.client).toBe("web");
  });

  it("can only be read once", () => {
    const store = fakeStore();
    rememberSignInAttempt(attempt, store);

    expect(takeSignInAttempt(store)).not.toBeNull();
    expect(takeSignInAttempt(store)).toBeNull();
    expect(store.size()).toBe(0);
  });

  it("has nothing to give when no attempt was started", () => {
    expect(takeSignInAttempt(fakeStore())).toBeNull();
  });

  it.each(["verifier", "nonce", "state", "redirectUri", "endpoint"])(
    "refuses a stored attempt with no %s",
    (missing) => {
      const store = fakeStore();
      const partial: Record<string, unknown> = { ...attempt };
      delete partial[missing];
      store.setItem("moat.sign-in-attempt", JSON.stringify(partial));

      expect(takeSignInAttempt(store)).toBeNull();
    },
  );

  it("survives a stored value that is not json", () => {
    const store = fakeStore();
    store.setItem("moat.sign-in-attempt", "not json");

    expect(takeSignInAttempt(store)).toBeNull();
  });

  it("works when the browser refuses storage altogether", () => {
    expect(() => rememberSignInAttempt(attempt, null)).not.toThrow();
    expect(takeSignInAttempt(null)).toBeNull();
  });
});

describe("matchesAttempt", () => {
  it("accepts the state it sent", () => {
    expect(matchesAttempt(attempt, "state-1")).toBe(true);
  });

  /* This is the whole reason for sending state: a code from an attempt nobody
     on this device started must not be spent. */
  it("refuses a state it never sent", () => {
    expect(matchesAttempt(attempt, "state-2")).toBe(false);
  });

  it("refuses when there is no attempt at all", () => {
    expect(matchesAttempt(null, "state-1")).toBe(false);
  });

  it("does not let two empty states match", () => {
    expect(matchesAttempt({ ...attempt, state: "" }, "")).toBe(false);
  });
});
