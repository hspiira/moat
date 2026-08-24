import { expect, test } from "@playwright/test";
import { openSeededApp } from "./harness";

// The brand and the menu are how you get anywhere else, so they stay put while
// the page scrolls, and they stay *visible* once pinned.
//
// That second part is what broke. The shell paints an opaque strip over the
// status bar, and the header pinned to 0, so on a phone it parked underneath
// that strip and vanished. A desktop browser reports no status bar inset, the
// strip collapses to nothing, and the bug is invisible. So the inset comes from
// one custom property that this test can set to a phone-like value.
const SAFE_TOP = 60;
const ROUTES = ["/settings", "/transactions", "/report"];

for (const route of ROUTES) {
  test(`${route} keeps the header visible below the status bar`, async ({ page }) => {
    await openSeededApp(page, route);
    await page.addStyleTag({ content: `:root { --safe-top: ${SAFE_TOP}px; }` });

    // The desktop bar is sticky too but display:none at this width, so the
    // phone one is named directly rather than by what it contains.
    const header = page.locator("header.sticky.lg\\:hidden");
    await expect(header).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 900));
    expect(
      await page.evaluate(() => window.scrollY),
      "the route has to actually scroll for this to prove anything",
    ).toBeGreaterThan(200);

    const box = await header.boundingBox();
    expect(box, "the header left the page entirely").not.toBeNull();
    // Clear of the painted strip rather than hidden behind it.
    expect(box!.y).toBeGreaterThanOrEqual(SAFE_TOP);
    // And still pinned near the top rather than scrolled away.
    expect(box!.y).toBeLessThan(SAFE_TOP + 24);
    await expect(header.locator('svg[aria-label="Moat"]')).toBeVisible();
  });
}
