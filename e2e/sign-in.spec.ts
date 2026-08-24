import { expect, test } from "@playwright/test";

import { openSeededApp } from "./harness";

const ATTEMPT = {
  verifier: "verifier-1",
  nonce: "nonce-1",
  state: "state-1",
  redirectUri: "http://localhost:4321/auth/callback",
  endpoint: "https://sync.example.com",
  proposedUserId: "user:e2e",
  existingAuthToken: "already-held",
};

async function arriveFromGoogle(
  page: import("@playwright/test").Page,
  params: { search: string; reply?: { status: number; body: unknown }; attempt?: unknown },
) {
  await openSeededApp(page, "/settings");

  if (params.reply) {
    await page.route("**/v1/auth/callback", (route) =>
      route.fulfill({
        status: params.reply!.status,
        contentType: "application/json",
        body: JSON.stringify(params.reply!.body),
      }),
    );
  }

  await page.evaluate((attempt) => {
    if (attempt) sessionStorage.setItem("moat.sign-in-attempt", JSON.stringify(attempt));
  }, params.attempt === undefined ? ATTEMPT : params.attempt);

  await page.goto(`/auth/callback${params.search}`);
  await page.waitForTimeout(1200);
}

test("a signed-in device keeps what is already on it", async ({ page }) => {
  await arriveFromGoogle(page, {
    search: "?code=abc&state=state-1",
    reply: {
      status: 200,
      body: { userId: "user:e2e", isNewUser: false, syncAuthToken: "fresh-token" },
    },
  });

  await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible();
  await expect(page.getByText("What is already here stays here.")).toBeVisible();
});

/* The wall the plan asked to word so a person can act on it. Merging two
   ledgers is refused, so the way onto that account is to restore its backup. */
test("says which wall you hit when the account already syncs another ledger", async ({ page }) => {
  await arriveFromGoogle(page, {
    search: "?code=abc&state=state-1",
    reply: {
      status: 409,
      body: { error: "This account is already syncing another Moat ledger." },
    },
  });

  await expect(page.getByRole("heading", { name: "Sign-in did not finish" })).toBeVisible();
  await expect(page.getByText("already syncing another Moat ledger")).toBeVisible();
  await expect(page.getByText("restore its encrypted backup here", { exact: false })).toBeVisible();
  await expect(page.getByText("Nothing on this device has changed.")).toBeVisible();
});

test("refuses a code from a sign-in this device never started", async ({ page }) => {
  await arriveFromGoogle(page, { search: "?code=abc&state=someone-elses", reply: undefined });

  await expect(page.getByText("did not start on this device", { exact: false })).toBeVisible();
});

test("says plainly when the sign-in was cancelled", async ({ page }) => {
  await arriveFromGoogle(page, { search: "?error=access_denied" });

  await expect(page.getByText("Sign-in was cancelled.")).toBeVisible();
});
