import { describe, expect, it } from "vitest";

import {
  iosRedirectUri,
  isOurCallbackUrl,
  readNativeCallbackUrl,
} from "@/lib/sync/native-sign-in";

const CLIENT = "123-abc.apps.googleusercontent.com";

describe("iosRedirectUri", () => {
  it("is the client id read backwards, as Google requires", () => {
    expect(iosRedirectUri(CLIENT)).toBe("com.googleusercontent.apps.123-abc:/oauth2redirect");
  });

  it("matches what the server will check it against", () => {
    // The server derives the same scheme from the same id, so a change to either
    // side alone would break sign-in on the phone.
    expect(iosRedirectUri(CLIENT).startsWith("com.googleusercontent.apps.123-abc:/")).toBe(true);
  });
});

describe("readNativeCallbackUrl", () => {
  it("finds the query on a scheme that is not a web address", () => {
    expect(
      readNativeCallbackUrl("com.googleusercontent.apps.123-abc:/oauth2redirect?code=a&state=b"),
    ).toBe("?code=a&state=b");
  });

  it("gives nothing back when there is no query at all", () => {
    expect(readNativeCallbackUrl("com.googleusercontent.apps.123-abc:/oauth2redirect")).toBe("");
  });
});

describe("isOurCallbackUrl", () => {
  it("recognises the app's own scheme", () => {
    expect(
      isOurCallbackUrl("com.googleusercontent.apps.123-abc:/oauth2redirect?code=a", CLIENT),
    ).toBe(true);
  });

  /* The app may be opened by other links. Treating any of them as a sign-in
     would spend a verifier on a code that is not there. */
  it("ignores a link that is not the sign-in coming back", () => {
    expect(isOurCallbackUrl("moat://something-else", CLIENT)).toBe(false);
    expect(isOurCallbackUrl("https://moat.example.com/report", CLIENT)).toBe(false);
  });

  it("ignores another app's scheme", () => {
    expect(
      isOurCallbackUrl("com.googleusercontent.apps.999-zzz:/oauth2redirect?code=a", CLIENT),
    ).toBe(false);
  });
});
