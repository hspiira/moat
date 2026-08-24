import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* The viewport is set to cover, so the page runs under the status bar and the
   rounded corners. A missing inset is invisible in a browser at a rectangular
   viewport and obvious on a phone, so this is checked at the source. */
describe("the app shell", () => {
  const source = readFileSync(path.join(process.cwd(), "components/app-shell.tsx"), "utf8");

  it("paints the strip the status bar sits on, so nothing shows through it", () => {
    expect(source).toContain("h-[env(safe-area-inset-top,0px)]");
    expect(source).toMatch(/aria-hidden[\s\S]{0,200}fixed inset-x-0 top-0/);
  });

  it.each(["top", "bottom", "left", "right"])("makes room for the %s safe area", (edge) => {
    const insetsBottom = readFileSync(
      path.join(process.cwd(), "components/navigation/nav-bottom-spacer.tsx"),
      "utf8",
    );

    expect(
      `${source}${insetsBottom}`.includes(`env(safe-area-inset-${edge}`),
      `nothing reserves space for the ${edge} inset, so content sits under the device chrome`,
    ).toBe(true);
  });
});
