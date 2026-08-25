import { describe, expect, it } from "vitest";

import { callerAddress, trustedProxyCount } from "./caller-address.js";

function request(forwarded: string | string[] | undefined, remoteAddress = "10.0.0.1") {
  return { headers: { "x-forwarded-for": forwarded }, socket: { remoteAddress } };
}

describe("trustedProxyCount", () => {
  it("trusts nothing unless a deployment says otherwise", () => {
    expect(trustedProxyCount({})).toBe(0);
  });

  it("reads the count a proxied deployment sets", () => {
    expect(trustedProxyCount({ MOAT_SYNC_TRUSTED_PROXIES: "2" })).toBe(2);
  });

  it("treats nonsense as trusting nothing rather than as one hop", () => {
    expect(trustedProxyCount({ MOAT_SYNC_TRUSTED_PROXIES: "-3" })).toBe(0);
    expect(trustedProxyCount({ MOAT_SYNC_TRUSTED_PROXIES: "banana" })).toBe(0);
    expect(trustedProxyCount({ MOAT_SYNC_TRUSTED_PROXIES: "" })).toBe(0);
  });
});

describe("callerAddress", () => {
  /* The header is the whole rate limit when it is trusted: a caller free to
     write it gets a new bucket per request, and the ten-per-minute guard on
     failed authentication is what that would spend. */
  it("ignores a forwarded header no proxy was declared for", () => {
    expect(callerAddress(request("1.2.3.4"), 0)).toBe("10.0.0.1");
  });

  it("cannot be moved off one bucket by rotating the header", () => {
    const keys = new Set(
      ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map((spoofed) => callerAddress(request(spoofed), 0)),
    );

    expect(keys).toEqual(new Set(["10.0.0.1"]));
  });

  it("takes the client address a single declared proxy appended", () => {
    expect(callerAddress(request("1.2.3.4"), 1)).toBe("1.2.3.4");
  });

  it("counts hops from the right, so an injected address is stepped over", () => {
    expect(callerAddress(request("9.9.9.9, 1.2.3.4"), 1)).toBe("1.2.3.4");
    expect(callerAddress(request("9.9.9.9, 1.2.3.4, 172.16.0.1"), 2)).toBe("1.2.3.4");
  });

  it("falls back to the socket when there are fewer hops than declared proxies", () => {
    expect(callerAddress(request("1.2.3.4"), 3)).toBe("10.0.0.1");
    expect(callerAddress(request(undefined), 1)).toBe("10.0.0.1");
  });

  it("reads a header the runtime split into several values", () => {
    expect(callerAddress(request(["9.9.9.9", "1.2.3.4"]), 1)).toBe("1.2.3.4");
  });

  it("says unknown rather than nothing when there is no address at all", () => {
    expect(callerAddress({ headers: {}, socket: {} }, 0)).toBe("unknown");
  });
});
