import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, openSeededApp } from "./harness";
import { buildLedgerFixture, FIXED_NOW } from "./fixtures/ledger";
import { seedIndexedDb } from "./seed-indexeddb";

test("cash-flow filtering preserves the current balance and buffer; balance can be hidden", async ({ page }) => {
  const { errors } = await openSeededApp(page, "/");
  // Home names itself for assistive tech only: the balance is the visible title.
  await expect(page.getByRole("heading", { name: "Your money", exact: true })).toHaveCount(1);
  const balance = page.getByTestId("dashboard-balance");
  const originalBalance = await balance.innerText();
  const buffer = page.getByRole("region", { name: "Your buffer" });
  const originalBuffer = await buffer.textContent();
  await page.getByRole("button", { name: "This year" }).click();
  await expect(balance).toHaveText(originalBalance);
  await expect(buffer).toHaveText(originalBuffer!);
  await page.getByRole("button", { name: "Hide balance" }).click();
  await expect(balance).toHaveText("••••••");
  await page.getByRole("button", { name: "Show balance" }).click();
  await expect(balance).toHaveText(originalBalance);
  await page.getByRole("link", { name: /Set your first budget/ }).click();
  await expect(page).toHaveURL(/\/plan\?section=budgets$/);
  await expect(page.getByRole("heading", { name: "Budgets", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("dashboard fits narrow phones and desktop, and recent activity opens its record", async ({ page }) => {
  await openSeededApp(page, "/");
  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoSidewaysScroll(page);
    const overflow = await page.locator("main").evaluate((main) =>
      [...main.querySelectorAll("[data-slot=money]")].filter((el) => el.scrollWidth > el.clientWidth + 1).length,
    );
    expect(overflow).toBe(0);
    if (width === 390 || width === 1280) {
      await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
    }
  }
  await page.getByRole("region", { name: "Recent activity" }).locator('a[href*="transaction="]').first().click();
  await expect(page).toHaveURL(/transaction=/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a new dashboard offers a first transaction instead of empty analysis", async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  const fixture = buildLedgerFixture();
  fixture.transactions = [];
  await seedIndexedDb(page, fixture);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Make this your money briefing" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Record your first transaction" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Import a statement" })).toBeVisible();
  await expect(page.getByText("A closer look", { exact: true })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
});


test("a populated plan shows an actionable bill and a stable buffer estimate", async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto("/transactions");
  const fixture = buildLedgerFixture();
  const expense = fixture.transactions.find((entry) => entry.type === "expense")!;
  const stamp = FIXED_NOW.toISOString();
  const historical = ["2026-05-01", "2026-06-01", "2026-07-01"].map((occurredOn) => ({
    ...expense, id: `history:${occurredOn}`, occurredOn, amount: 800_000,
    originalAmount: 800_000, createdAt: `${occurredOn}T09:00:00Z`,
  }));
  await seedIndexedDb(page, {
    ...fixture,
    transactions: [...historical, ...fixture.transactions],
    budgets: [{ id: "dashboard-budget", userId: fixture.userProfile.id, month: "2026-08", categoryId: expense.categoryId, targetAmount: 400_000, createdAt: stamp, updatedAt: stamp }],
    recurringObligations: [{ id: "dashboard-rent", userId: fixture.userProfile.id, name: "Rent", type: "rent", categoryId: expense.categoryId, expectedAmount: 850_000, cadence: "monthly", dueDay: 20, payee: "Landlord", status: "active", createdAt: stamp, updatedAt: stamp }],
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Needs your attention" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Rent is due in 3 days/ })).toBeVisible();
  const buffer = page.getByRole("progressbar", { name: "Emergency buffer" });
  await expect(buffer).toBeVisible();
  const cover = await buffer.getAttribute("aria-valuetext");
  await page.getByRole("button", { name: "This week" }).click();
  await expect(buffer).toHaveAttribute("aria-valuetext", cover!);
  await page.getByRole("button", { name: "This month" }).click();
  await page.screenshot({ path: "test-results/dashboard-populated-390.png", fullPage: true });
  await page.getByRole("link", { name: /Bills to pay/ }).click();
  await expect(page).toHaveURL(/section=bills/);
  await expect(page.getByRole("heading", { name: "Bills that repeat" })).toBeVisible();
});
