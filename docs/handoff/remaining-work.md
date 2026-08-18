# Brief: remaining work on Moat

You are picking up a local-first personal finance PWA. This brief is the whole
task. Read it fully before touching anything.

## The app

Moat tracks cash, mobile money, bank and SACCO accounts for a single user in
Uganda. Next.js 16 with `output: "export"`, so there are **no route handlers and
no server at runtime** on the web side. Data lives in IndexedDB behind a
`StorageAdapter` abstraction that also has a SQLite implementation for the
Android shell. Records are encrypted at rest with a key derived from the user's
PIN. Currency is UGX, which has **no subdivision**: every stored amount is a
whole-shilling integer, and both the input guard and a load-time repair enforce
that. Do not reintroduce fractional money.

There is one user. He is the developer. There is no production traffic and
nothing has ever synced, so you owe zero data migrations to anybody but him.

## House rules, in order of how much they matter

1. **Do not write comments.** The owner has asked for this repeatedly and 2,555 lines of
   them were stripped from the codebase deliberately in commit `643487c`. Write a comment
   only where a reader would otherwise change the code and break it, and keep it
   to one line. No file headers, no JSDoc restating the signature, no comments
   above tests whose name already says it.
2. **Verify claims on screen, not in code.** Reading a diff is not evidence.
   Every UI change gets driven in a real browser before you say it works.
3. **Mutation-test every guard you add.** Break the fix, watch the specific test
   fail, restore it. A test that passes against the broken code is not a test.
   This has caught three worthless tests already.
4. **Never commit before the build passes.** This has been got wrong once.
5. **Report honestly.** If something is unfinished, blocked, or you were wrong
   earlier, say so plainly in the commit and in your summary. Do not round up.
6. Commits carry no AI attribution: no `Co-Authored-By`, no "Generated with"
   line.

## How to verify

```
pnpm verify
```

runs typecheck, lint, build, the sync-server build, 736 unit tests and 31
browser journeys, in that order. The build runs **before** the tests on purpose:
one test asserts every precached route has an exported file, and it was silently
checking a stale build until that was fixed.

The suite pins `TZ=Africa/Kampala` in `vitest.config.ts`. Date handling is
timezone-sensitive and a test that passes on a UTC runner but not locally has
already burned a CI run. Use `todayIso()` and `currentMonthIso()` from
`lib/today.ts`; a test fails the build if any source file reaches for
`toISOString().slice(0, 10)` again.

### Browser journeys

Playwright, in `e2e/`. One project named `phone` at 390x844, because both
mobile faults that shipped past a green suite only reproduce at that width. It
serves the real static export through `scripts/serve-static.mjs`, not a dev
server.

- `e2e/fixtures/ledger.ts` builds a synthetic ledger. It is committed. **Never
  put real financial data in the repo.**
- `e2e/seed-indexeddb.ts` writes a bundle straight into IndexedDB, which works
  only while no PIN is set.
- `e2e/harness.ts` has `openSeededApp`, `expectLedgerIntact` and
  `expectNoSidewaysScroll`. Reuse them.
- The clock is frozen with `page.clock.install` so "today" never drifts.

`expectLedgerIntact` asserts the invariants that have actually broken in
production: no fee pointing at a deleted payment, every transfer group nets to
zero, no leg without its partner. Assert it after any mutation you write.

## The work

Ordered. Do them in this order; each one is a separate commit.

---

### 1. Backup staleness reminder

**Why first:** an hour of work that protects everything else. The app's entire
value lives in one browser profile. `lastBackupAt` is already recorded in
`lib/preferences/google-drive-backup.ts` and then never read to decide anything.
There is no "your last backup was 47 days ago" anywhere.

**Build:** a pure function that turns `lastBackupAt` plus now into a staleness
state, and a surface for it. `components/pwa-status.tsx` already renders a
dismissible storage notice with a per-notice dismissal in
`lib/preferences/storage-notice.ts`. Add a `stale-backup` notice kind and reuse
that machinery, including the dismissal.

**Acceptance:**
- Unit tests for the staleness boundaries, including never-backed-up and
  backed-up-today.
- A browser journey seeding a `lastBackupAt` far in the past and asserting the
  notice appears, plus one seeding a recent date and asserting it does not.
- Mutation check: remove the staleness comparison, watch the journey fail.

---

### 2. Failure-path journeys

**Why:** not one of the 31 existing journeys deliberately breaks anything. For a
local-first money app, the failure paths are where data is lost, and the happy
path is already covered.

**Build** journeys that induce real failures and assert the app stays honest and
the ledger stays intact:

- A storage write that throws mid-save. Assert the user sees an error, and that
  `expectLedgerIntact` still holds. Nothing half-written.
- Restore handed a corrupt or truncated backup file. Assert a clear message and
  that existing data is untouched.
- Restore handed a valid backup with the wrong PIN.
- A transaction record that decrypts to garbage. Assert the app renders rather
  than white-screening.
- The PIN entered wrong repeatedly, hitting the throttle.

Induce failures with `page.addInitScript` to stub the relevant browser API, the
way `e2e/storage.spec.ts` already stubs `navigator.storage`.

**Acceptance:** each journey fails if you remove the error handling it covers.
Where you find the app does not handle a case, fix the app, do not weaken the
test.

---

### 3. Migration safety

**Why:** the largest data-loss risk in the codebase. It is dormant only because
hosted sync is gated off.

Opting into sync runs `migrateIdsToCuid2` (`lib/app-state/id-migration.ts`)
across every record. Read `docs/plans/data-integrity.md` section 1. Two faults:

- **No backup gate.** It rewrites every id with nothing taken first.
- **Not resumable.** It writes replacements before deleting originals, and the
  IndexedDB adapter has **no transaction spanning stores**, so an interruption
  leaves a half-rewritten ledger with no way to finish or roll back.

**Build:**
- Refuse to start unless a backup was taken within the session, or take one
  automatically and verify it round-trips before proceeding.
- Make it resumable: record progress durably so a re-run completes rather than
  restarting, and make every step idempotent.
- A dry-run that reports what would change without writing.

**Acceptance:** a test that kills the migration partway and re-runs it, ending
with a ledger identical to a clean run. This is the test that matters; write it
first.

---

### 4. Accessibility audit

**Why:** nobody has ever run one. Labels were eyeballed once.

**Build:** add `@axe-core/playwright`, run it across every route in a journey,
and fix what it finds. Pay particular attention to contrast, tap-target size and
focus order, since this is a one-handed phone app.

**Acceptance:** the journey fails on any serious or critical violation. If a
violation is a deliberate design choice, suppress it explicitly with a reason
rather than lowering the threshold.

---

### 5. Savings contributions have no destination

Read `docs/plans/data-integrity.md` section 3. A savings contribution records
that money was set aside but not where it went, so it cannot be reconciled
against an account. Implement the design in the plan.

**Acceptance:** existing savings contributions keep working, new ones carry a
destination, and the accounting properties in
`lib/domain/accounting.property.test.ts` still hold.

---

### 6. Party identity

Read `docs/plans/data-integrity.md` section 4. Counterparties are the
subsidiary ledger for lending and borrowing; per-person balances derive from
`counterpartyId`, not from payee text. Finish the unification described there.
`lib/domain/counterparty-merge.ts` already exists and is tested.

---

### 7. Hosted sync: auth and encryption

**Leave the feature gated behind `NEXT_PUBLIC_ENABLE_HOSTED_SYNC` until all of
this is done.** Nothing has ever synced, which is why there are no migrations to
write. Do not spend that.

Three blockers, documented in the code itself at
`lib/sync/server-contract.ts`:

- **Tenancy is self-asserted.** `userId` comes from the request body and there is
  one shared bearer token, so any holder can read or write any user's data. The
  Postgres row-level security policies are correctly written but key off a value
  the caller supplies. Needs real per-user authentication.
- **Payloads are plaintext.** `server/src/db/schema.ts` stores `payload text`, so
  the server reads every transaction, payee and amount in the clear. The privacy
  page commits to documenting the encryption posture. Encrypt before it leaves
  the device.
- **Token comparison is not constant-time** (`!==` in `validateSyncBearerToken`).

This is the largest item and may warrant its own plan document before code.

---

## Things that are already fine

Do not "fix" these:

- **Performance.** Measured at 6,000 transactions across five years: every
  screen loads in under 700ms with no errors.
- **Money representation.** Integer shillings, guarded on input and repaired on
  load. Leave it alone.
- **The seeded-defaults reconcilers.** They previously duplicated every category
  and account; the fix matches legacy slugs and is pinned by tests. Understand
  them before changing them.

## Where to look

- `docs/plans/data-integrity.md` is the authoritative list of known data faults.
- `docs/tracker.md` is the authoritative build status.
- `docs/plans/hosted-sync.md` covers the sync design.
- `lib/domain/` is pure and well tested. Put decisions there and keep IO in
  `lib/repositories/`. The transactions workspace hook was split along that line
  and three ledger bugs fell out of the split.

## When you are done

Report what you did, what you verified and how, and what you did not do and why.
If you disagree with anything in this brief, say so rather than working around
it.
