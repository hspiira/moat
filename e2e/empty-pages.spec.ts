import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

// A page with nothing on it still has to say what it is for, or it reads as
// broken. These pages had no empty state at all, or only named themselves.
const PAGES = [
  { path: "/shopping", says: "this page remembers what it cost you last time" },
  { path: "/inbox", says: "Paste an SMS or a mobile-money notification" },
];

for (const page_ of PAGES) {
  test(`${page_.path} says what it is for when it is empty`, async ({ page }) => {
    await openSeededApp(page, page_.path);
    await expect(page.getByText(page_.says, { exact: false })).toBeVisible();
  });
}
