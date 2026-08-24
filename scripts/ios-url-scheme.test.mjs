import { describe, expect, it } from "vitest";

import { schemeFor, withUrlScheme } from "./ios-url-scheme.mjs";

const PLIST = `<?xml version="1.0"?>
<plist version="1.0">
<dict>
\t<key>CFBundleName</key>
\t<string>Moat</string>
</dict>
</plist>`;

describe("schemeFor", () => {
  it("reads the client id backwards, as Google requires", () => {
    expect(schemeFor("123-abc.apps.googleusercontent.com")).toBe(
      "com.googleusercontent.apps.123-abc",
    );
  });

  it("survives a value with stray whitespace", () => {
    expect(schemeFor("  123-abc.apps.googleusercontent.com \n")).toBe(
      "com.googleusercontent.apps.123-abc",
    );
  });
});

describe("withUrlScheme", () => {
  it("declares the scheme iOS needs to deliver the callback", () => {
    const out = withUrlScheme(PLIST, "com.googleusercontent.apps.123-abc");

    expect(out).toContain("<key>CFBundleURLTypes</key>");
    expect(out).toContain("<string>com.googleusercontent.apps.123-abc</string>");
  });

  it("keeps what was already in the file", () => {
    expect(withUrlScheme(PLIST, "s")).toContain("<key>CFBundleName</key>");
  });

  it("stays valid, closing the dict and the plist once", () => {
    const out = withUrlScheme(PLIST, "s");

    expect(out.match(/<\/dict>\n<\/plist>/g)).toHaveLength(1);
    expect(out.endsWith("</plist>")).toBe(true);
  });

  /* Run on every build, so it has to replace its own work rather than pile up
     another copy each time. */
  it("can be run again without adding a second block", () => {
    const once = withUrlScheme(PLIST, "com.googleusercontent.apps.123-abc");
    const twice = withUrlScheme(once, "com.googleusercontent.apps.123-abc");

    expect(twice).toBe(once);
    expect(twice.match(/CFBundleURLTypes/g)).toHaveLength(1);
  });

  it("replaces the old scheme when the client id changes", () => {
    const once = withUrlScheme(PLIST, "com.googleusercontent.apps.old");
    const twice = withUrlScheme(once, "com.googleusercontent.apps.new");

    expect(twice).toContain("apps.new");
    expect(twice).not.toContain("apps.old");
  });
});
