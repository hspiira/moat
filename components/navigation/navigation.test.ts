import { describe, expect, it } from "vitest";

import { navItems } from "@/lib/data";

import {
  getMobileContextNavItem,
  getNavEntry,
  mobileCadenceNav,
  mobileCaptureActions,
  mobilePrimaryNav,
  mobileSecondaryNav,
  navIcons,
} from "./navigation-shared";

describe("navigation reachability", () => {
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

  const cadenceHrefs = mobileCadenceNav.flatMap((group) => [...group.hrefs]);

  it("lets the More pill name every route it opens", () => {
    for (const href of [...mobileSecondaryNav, ...cadenceHrefs]) {
      expect(getMobileContextNavItem(href), `${href} is missing from mobileContextNav`).toBeDefined();
    }
  });

  it("gives each cadence row its own entry, not a parent's", () => {
    for (const href of cadenceHrefs) {
      expect(getNavEntry(href)?.href, `${href} has no entry of its own`).toBe(href);
    }
  });

  it("gives every cadence destination an icon", () => {
    for (const href of cadenceHrefs) {
      expect(navIcons[href], `${href} has no icon in navIcons`).toBeDefined();
    }
  });

  it("files each cadence destination under exactly one heading", () => {
    expect(new Set(cadenceHrefs).size).toBe(cadenceHrefs.length);
  });

  it("keeps the capture actions off the cadence sections", () => {
    const capturePaths = mobileCaptureActions.map((action) => action.href.split("?")[0]);
    for (const href of cadenceHrefs) {
      expect(capturePaths, `${href} is already a capture action`).not.toContain(href);
    }
  });

  it("keeps the mobile lists pointing at real destinations", () => {
    const known = new Set(navItems.map((item) => item.href));

    for (const href of mobileReachable) {
      expect(known.has(href), `${href} is in the mobile navigation but not in navItems`).toBe(true);
    }
  });
});
