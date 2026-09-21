import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { navItems } from "@/lib/data";

import {
  desktopMenuHrefs,
  desktopPrimaryNav,
  desktopShortcutNav,
} from "./desktop-navigation";
import {
  getActiveGroupedEntry,
  getMobileNavLabel,
  getNavEntry,
  groupedHrefs,
  mobileCaptureActions,
  mobileNavLabels,
  mobilePrimaryNav,
  navGroups,
  navGroupsExcluding,
  navIcons,
  settingsDestinations,
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

  // The button is still highlighted from inside the menu, which is what this
  // reports. What it must not do is rename the button: see the mobile bar
  // tests below for the label itself.
  it("knows when the reader is somewhere inside the menu", () => {
    for (const href of groupedHrefs) {
      expect(getActiveGroupedEntry(href)?.href, `${href} does not mark the menu`).toBe(href);
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

describe("the mobile bar", () => {
  it("fills five fixed slots: three destinations, Add and More", () => {
    expect(mobilePrimaryNav.length).toBe(3);
  });

  it("gives every slot a name and an icon", () => {
    for (const href of mobilePrimaryNav) {
      expect(getMobileNavLabel(href), `${href} has no name in the bar`).toBeTruthy();
      expect(navIcons[href], `${href} has no icon in the bar`).toBeDefined();
    }
  });

  // Slot names are fixed width, so a long one would be truncated on a 320px
  // screen. Anything longer than this needs a shorthand in mobileNavLabels.
  it("keeps every slot name short enough to render whole", () => {
    for (const href of mobilePrimaryNav) {
      expect(getMobileNavLabel(href).length, `${href} is too long for a slot`).toBeLessThanOrEqual(9);
    }
  });

  // A shorthand is allowed to be shorter than the page heading. It is not
  // allowed to point somewhere the destination does not go.
  it("only shortens names it has a destination for", () => {
    for (const href of Object.keys(mobileNavLabels)) {
      expect(getNavEntry(href)?.href, `${href} is shortened but is not a destination`).toBe(href);
    }
  });

  it("falls back to a destination's own name", () => {
    expect(getMobileNavLabel("/accounts")).toBe("Accounts");
  });
});

describe("configuration Settings owns", () => {
  it("keeps rules and categories out of the destination menu", () => {
    for (const href of settingsDestinations) {
      expect(groupedHrefs, `${href} is configuration, not a menu destination`).not.toContain(href);
    }
  });

  it("still names and illustrates each of them", () => {
    for (const href of settingsDestinations) {
      expect(getNavEntry(href)?.href, `${href} has no entry of its own`).toBe(href);
      expect(navIcons[href], `${href} has no icon`).toBeDefined();
    }
  });

  // Removing them from the menu orphans them unless Settings links to them.
  it("is linked from the settings page", () => {
    const settings = readFileSync(
      new URL("../settings-workspace.tsx", import.meta.url),
      "utf8",
    );

    for (const href of settingsDestinations) {
      expect(settings, `Settings has no row for ${href}`).toContain(`"${href}"`);
    }
  });
});
