import { describe, expect, it } from "vitest";

import { navItems } from "@/lib/data";

import {
  desktopMenuHrefs,
  desktopPrimaryNav,
  desktopShortcutNav,
} from "./desktop-navigation";
import {
  getActiveGroupedEntry,
  getNavEntry,
  groupedHrefs,
  mobileCaptureActions,
  mobilePrimaryNav,
  navGroups,
  navGroupsExcluding,
  navIcons,
} from "./navigation-model";

const mobileReachable = new Set<string>([...mobilePrimaryNav, ...groupedHrefs]);
const desktopReachable = new Set<string>([
  ...desktopPrimaryNav,
  ...desktopShortcutNav,
  ...desktopMenuHrefs,
]);

describe("navigation reachability", () => {
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
        `${item.href} is in navItems but in neither mobilePrimaryNav nor navGroups`,
      ).toBe(true);
    }
  });

  // Rules & corrections was reachable on a phone and nowhere on a laptop, which
  // the old mobile-only assertion could not see.
  it("reaches every destination from the desktop navigation", () => {
    for (const item of navItems) {
      expect(
        desktopReachable.has(item.href),
        `${item.href} is in navItems but unreachable from the desktop bar or menu`,
      ).toBe(true);
    }
  });

  it("puts the same destinations on both platforms", () => {
    expect([...desktopReachable].sort()).toEqual([...mobileReachable].sort());
  });
});

describe("the grouped menu", () => {
  it("names and illustrates every row it renders", () => {
    for (const href of groupedHrefs) {
      expect(getNavEntry(href)?.href, `${href} has no entry of its own`).toBe(href);
      expect(navIcons[href], `${href} has no icon in navIcons`).toBeDefined();
    }
  });

  it("files each destination under exactly one heading", () => {
    expect(new Set(groupedHrefs).size).toBe(groupedHrefs.length);
  });

  it("never repeats a destination the bar already shows", () => {
    for (const href of mobilePrimaryNav) {
      expect(groupedHrefs, `${href} would render twice on a phone`).not.toContain(href);
    }

    for (const href of [...desktopPrimaryNav, ...desktopShortcutNav]) {
      expect(desktopMenuHrefs, `${href} would render twice on a laptop`).not.toContain(href);
    }
  });

  it("drops a heading rather than rendering it empty", () => {
    const onlyGroup = navGroups[0];
    const groups = navGroupsExcluding(onlyGroup.hrefs);

    expect(groups.map((group) => group.title)).not.toContain(onlyGroup.title);
    for (const group of groups) {
      expect(group.hrefs.length).toBeGreaterThan(0);
    }
  });

  it("labels the More pill with wherever the reader actually is", () => {
    for (const href of groupedHrefs) {
      expect(getActiveGroupedEntry(href)?.href, `${href} does not label the pill`).toBe(href);
    }

    expect(getActiveGroupedEntry("/")).toBeUndefined();
  });

  it("keeps the capture actions out of the menu", () => {
    const capturePaths = mobileCaptureActions.map((action) => action.href.split("?")[0]);

    for (const path of capturePaths) {
      expect(groupedHrefs).not.toContain(path);
    }
  });
});
