import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* The viewport is set to cover, so the page runs under the status bar and the
   rounded corners. A missing inset is invisible in a browser at a rectangular
   viewport and obvious on a phone, so this is checked at the source. */
describe("the app shell", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const source = read("components/app-shell.tsx");

  it("paints the strip the status bar sits on, so nothing shows through it", () => {
    expect(source).toContain("h-(--safe-top)");
    expect(source).toMatch(/aria-hidden[\s\S]{0,200}fixed inset-x-0 top-0/);
  });

  it("takes the top inset from one place, so the strip and the header agree", () => {
    // These two numbers have to match. When they did not, the header pinned to
    // 0 and parked behind the painted strip, invisible on a phone and fine in
    // any desktop browser.
    expect(read("app/globals.css")).toContain("--safe-top: env(safe-area-inset-top, 0px)");
    expect(source).toContain("h-(--safe-top)");
    expect(read("components/navigation/mobile-navigation.tsx")).toContain(
      "sticky top-(--safe-top)",
    );
  });

  it.each(["bottom", "left", "right"])("makes room for the %s safe area", (edge) => {
    const insetsBottom = read("components/navigation/nav-bottom-spacer.tsx");

    expect(
      `${source}${insetsBottom}`.includes(`env(safe-area-inset-${edge}`),
      `nothing reserves space for the ${edge} inset, so content sits under the device chrome`,
    ).toBe(true);
  });

  it("makes room for the top safe area", () => {
    expect(source).toContain("pt-[max(0.5rem,var(--safe-top))]");
  });
});
