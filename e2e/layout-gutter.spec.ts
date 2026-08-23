import { expect, test } from "@playwright/test";
import { openSeededApp } from "./harness";

// Cards reach the screen edge on a phone; everything else keeps the shell's
// 16px gutter. This fails if new content lands outside a card without it.
const ROUTES = [
  "/", "/transactions", "/transactions/capture", "/accounts", "/budgets", "/debt",
  "/goals", "/import", "/inbox", "/learn", "/month",
  "/privacy", "/recurring", "/report", "/settings", "/settings/categories",
  "/settings/rules", "/settings/sync-conflicts", "/shopping", "/onboarding",
];

for (const route of ROUTES) {
  test(`${route} keeps text off the screen edge`, async ({ page }) => {
    await openSeededApp(page, route);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.textContent ?? "").trim();
        if (!text) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        const style = getComputedStyle(parent);
        if (style.visibility === "hidden" || style.display === "none") continue;
        if (parent.closest(".sr-only")) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < 8) {
          out.push(`${parent.tagName} @${Math.round(r.left)} "${text.slice(0, 32)}"`);
        }
      }
      return {
        touching: [...new Set(out)].slice(0, 4),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(bad.touching, `${route} has text against the screen edge`).toEqual([]);
    expect(bad.overflow, `${route} scrolls sideways`).toBe(0);
  });
}
