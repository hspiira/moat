import { describe, expect, it } from "vitest";

import { navItems } from "@/lib/data";

import {
  getMobileContextNavItem,
  mobilePrimaryNav,
  mobileSecondaryNav,
  navIcons,
} from "./navigation-shared";

describe("navigation reachability", () => {
  // Regression guard: the desktop bar derives its overflow from navItems, but
  // the mobile capsule and its More sheet read hardcoded lists. A route added
  // to navItems alone reaches the desktop and is invisible on mobile — which
  // is how /shopping shipped unreachable on phones.
  const mobileReachable = new Set<string>([...mobilePrimaryNav, ...mobileSecondaryNav]);

  it("gives every destination an icon", () => {
    expect(navItems.length).toBeGreaterThan(5);

    for (const item of navItems) {
      expect(navIcons[item.href], `${item.href} has no icon in navIcons`).toBeDefined();
    }
  });

  it("reaches every destination from the mobile navigation", () => {
    for (const item of navItems) {
      expect(
        mobileReachable.has(item.href),
        `${item.href} is in navItems but in neither mobilePrimaryNav nor mobileSecondaryNav`,
      ).toBe(true);
    }
  });

  it("lets the More pill name every route it opens", () => {
    // The heading defers to the nav, so a route the pill cannot name has no
    // wayfinding at all once you are on it.
    for (const href of mobileSecondaryNav) {
      expect(getMobileContextNavItem(href), `${href} is missing from mobileContextNav`).toBeDefined();
    }
  });

  it("keeps the mobile lists pointing at real destinations", () => {
    const known = new Set(navItems.map((item) => item.href));

    for (const href of mobileReachable) {
      expect(known.has(href), `${href} is in the mobile navigation but not in navItems`).toBe(true);
    }
  });
});
