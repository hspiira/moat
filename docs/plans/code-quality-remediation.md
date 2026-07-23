# Moat — Code Quality Remediation Plan (SOLID / DRY / SWE hygiene)

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Remediation plan |
| Owner | Piira |
| Last Updated | 2026-07-23 |
| Scope | Full-codebase quality audit: lib/domain, lib/repositories, lib/capture, lib/sync, lib/security, lib/integrations, components/, app/ |

## Summary

A five-track parallel review of the codebase (~26k lines, ~250 source files) found no architectural rot — the layering (domain → repositories → workspaces → routes) is sound and mostly respected. The problems are concentrated in four patterns:

1. **Lockstep duplication between parallel implementations** (IndexedDB vs SQLite backends, the three capture parser packs, preview vs persist transaction mapping). These are the highest-risk items because the copies are *supposed* to stay identical and nothing enforces it.
2. **Business rules re-implemented inline at multiple call sites** instead of named once in `lib/domain` (spending predicate ×5, transfer detection ×2 competing definitions, currency formatting ×7).
3. **Two god files** that ignore the codebase's own established patterns (`onboarding-workspace.tsx` at 1014 lines, `pin-lock-context.tsx` at ~447 lines).
4. **Confirmed dead code** (~300 lines of `lib/data.ts`, several capture exports, unused crypto helpers).

Two findings are latent **bugs**, not just hygiene, and should be fixed first (Phase 0).

## Phase 0 — Latent bugs found during the audit (do first, tiny diffs) — ✅ COMPLETED 2026-07-23 (commit 3b20e07)

> Note: 0.2 consolidated 3 of the 4 codec sites. The fourth (`pin-lock-context.tsx`) is deliberately untouched — that file has in-flight uncommitted work; its local copy is already the safe loop variant. Fold it in with Phase 4.2.

| # | Finding | Location | Fix |
| --- | --- | --- | --- |
| 0.1 | `rules.sort(...)` mutates React state in place during render | `components/transactions/transaction-rules-panel.tsx:247` | `[...rules].sort(...)` |
| 0.2 | Base64 codec hand-rolled in 4 crypto files and already diverged; the spread variant (`String.fromCharCode(...bytes)`) can throw `RangeError` on large encrypted backups | `lib/security/pin-crypto.ts:25-36`, `lib/security/record-crypto.ts:123-134`, `lib/security/key-hierarchy.ts:63-78`, `lib/security/pin-lock-context.tsx:122-129` | Create `lib/security/codec.ts` with the safe loop implementation; all four import from it |
| 0.3 | Transfer classification has two competing definitions: `isTransferTransaction` (type OR category) vs raw `type === "transfer"` — category-tagged transfers vanish from transfer buckets | `lib/domain/summaries.ts:24-26`, `lib/domain/accounts.ts:115-117`, `lib/domain/insights.ts:80` vs `lib/domain/transfers.ts:3-5` | Route all checks through `isTransferTransaction`; add a regression test for a category-tagged transfer |

Exit criteria: `pnpm typecheck && pnpm lint && pnpm test` green; new test covering 0.3.

## Phase 1 — Single-source the duplicated business rules (small, independent PRs) — ✅ COMPLETED 2026-07-23 (commit 2b1c739, all 12 items)

Each item is a mechanical extract-and-replace; they can be done in any order.

| # | Finding | Locations | Fix |
| --- | --- | --- | --- |
| 1.1 | "expense or debt_payment counts as spending" inlined 5× | `lib/domain/accounts.ts:108`, `budgets.ts:34,75`, `summaries.ts:17,41` | Extract `isSpendingTransaction()` next to `isTransferTransaction` |
| 1.2 | `formatCurrency` reimplemented 7× in components, byte-identical to `formatMoney` in `lib/currency.ts` | 7 files under `components/dashboard/`, `components/accounts/`, `components/transactions/` (see audit) | Delete locals, import `formatMoney`; prefer `<Money>` where rendering |
| 1.3 | Account-type label ternary in onboarding duplicates `accountTypeOptions()` | `components/onboarding-workspace.tsx:801-815` | Use `accountTypeOptions(defaultAccountTypes)` |
| 1.4 | Parser scaffolding (`normalizeCurrency`, `parseAmount`, `toIsoDate`) byte-identical in all 3 provider packs | `lib/capture/providers/{mtn-uganda,airtel-money-uganda,bank-alert-generic}.ts:4-24` | Extract `lib/capture/providers/shared.ts`; packs keep only their regexes |
| 1.5 | Preview vs persisted Transaction mapping duplicated (~15 field assignments) — rule preview can silently diverge from what persists | `lib/capture/review-queue.ts:122-154` vs `lib/capture/persistence.ts:30-62` | Extract shared `mapReviewItemToTransactionFields()`; layer id/linkage fields per call site |
| 1.6 | Debt payoff comparator duplicated with different field names (`remaining` vs `outstandingBalance`) | `lib/domain/debt.ts:190-201` vs `:262-270` | Extract `compareDebtsByStrategy()` over a normalized `{interestRate, balance, name}` shape |
| 1.7 | Capture validation rules computed twice with different output shapes | `lib/capture/confidence.ts:3-34` vs `lib/capture/review-queue.ts:19-38` | Derive issue strings from `fieldWarnings` instead of re-checking |
| 1.8 | Backup filename convention re-encoded as magic strings across module boundary | `lib/security/encrypted-backup.ts:12-15` vs `lib/integrations/google-drive-backup.ts:277` | Export `isBackupFilename()` from `encrypted-backup.ts` |
| 1.9 | Google OAuth token acquisition duplicated | `lib/integrations/google-drive-backup.ts:144-172` vs `:174-202` | `ensureAccessToken` becomes a one-line wrapper over `requestAccessToken` |
| 1.10 | Magic financial constants in debt simulation (`0.01` ×5, `600`, `0.03`) | `lib/domain/debt.ts:86,192,211,229,237,247` | Hoist `BALANCE_EPSILON`, `MAX_PAYOFF_MONTHS`, `DEFAULT_MIN_PAYMENT_RATE` |
| 1.11 | `deduplication.ts` redefines `normalizeCaptureName` locally | `lib/capture/deduplication.ts:4-6` | Import from `normalizers.ts` |
| 1.12 | Dashboard re-derives account totals inline | `components/dashboard-workspace.tsx:72-73` | Call `getAccountTotals()` |

Exit criteria: all checks green; no behavior change (these are pure refactors — property tests in `lib/domain` should pass untouched).

## Phase 2 — Dead code removal (one PR, pure deletion) — ✅ COMPLETED 2026-07-23 (commits 1489619 + 7e3d1c4, ~674 lines deleted)

> Extension beyond the audit list: `components/module-page.tsx` and `components/milestone-list.tsx` were themselves orphaned, so they and the `ModuleDetail`/`Milestone` types were removed too. Follow-up noted for later: the Kotlin `listByField` native command is now unreachable from TS (native cleanup was out of scope).

| # | Finding | Location |
| --- | --- | --- |
| 2.1 | ~300 lines of unused, *stale* marketing/roadmap data + 4 unused types (content contradicts current product state) | `lib/data.ts:43-154,189-440`; `lib/types.ts:78-135` (ProductHighlight, AppSection, ModuleDetail, Milestone) |
| 2.2 | Dead pass-through `parseWithTemplates` | `lib/capture/parser-templates.ts` (delete file) |
| 2.3 | Unused `createCaptureEnvelope` + `inferEnvelopeSourceFromTransactionSource` | `lib/capture/review-queue.ts:40-62,180-187` |
| 2.4 | Unused `deriveSessionKey` (pre-Argon2id leftover) | `lib/security/pin-crypto.ts:115-117` |
| 2.5 | `SqliteClient.listByField` in the public contract with zero production callers | `lib/repositories/sqlite/client.ts:14-18,57-59` (fold into `listByFields` or drop) |
| 2.6 | Misleading dead ternary in outbox attempt counting | `lib/sync/engine.ts:16` → `attempts: item.attempts + 1` |
| 2.7 | Three identical no-op migration blocks (`<5`, `<7`, `<8` all just `ensureStore` loops) | `lib/repositories/indexeddb/client.ts:137-158` — collapse into one unconditional ensure-stores pass |

Verify each deletion with a project-wide grep before removing (the audit already did one pass; re-verify at PR time).

## Phase 3 — The repository backend unification (highest-value structural fix) — ✅ COMPLETED 2026-07-23 (commit 4fa6570)

> Landed: neutral `store-names.ts`, `StorageAdapter` interface, single `shared.ts` implementation (outbox policy + 17 factories + fault-tolerance policy both backends now inherit), `indexeddb/rekey.ts`, single-sourced `MIGRATION_VERSIONS`, generic lazy proxies, and a 15-case cross-backend contract suite (incl. encrypted-path and local_only suppression). The two repository.ts files: 817 → 226 lines. Accepted limitation: the SQLite side of the contract suite runs against an in-memory fake, not the Kotlin bridge.

**Problem (High/DRY + DIP + resilience-consistency):** the entire repository layer — outbox enqueue policy, unsynced-store list, user-scoped CRUD wrapper, and all 17 entity factories — is duplicated in lockstep between `lib/repositories/indexeddb/repository.ts` (513 lines) and `lib/repositories/sqlite/repository.ts` (304 lines). Sync semantics are security- and correctness-sensitive; nothing enforces the two copies stay identical. Additionally:

- SQLite imports `StoreName` from the IndexedDB module (backend coupling, DIP violation).
- The "skip unreadable record, log and continue" resilience policy exists **only** in the IndexedDB backend — the SQLite/native path throws on a single bad row, contradicting the project's own graceful-failure principle (see memory/commit "Develop around failure modes").

**Plan:**

1. Move `storeNames`/`StoreName` to a neutral `lib/repositories/store-names.ts`.
2. Define a minimal `StorageAdapter` interface: `getById`, `listByUser`, `listAll`, `upsert`, `remove` (+ the few extra query primitives each backend genuinely needs).
3. Implement once, against the adapter: `createUserScopedRepository`, `enqueueSyncMutation`, the unsynced-store list, and all 17 entity factories.
4. `indexeddb/` and `sqlite/` shrink to: adapter implementation + backend-specific concerns (IndexedDB migrations + re-keying snapshot helpers → extract to `indexeddb/rekey.ts`; SQLite native bridge).
5. Put the per-record fault-tolerance policy (decrypt/parse failure → warn + skip) **in the shared layer** so both backends inherit it — this closes the resilience gap as a side effect.
6. Also fold in: single source of truth for migration versions (`MIGRATION_VERSIONS` array driving both `runMigrations` and `getIndexedDbMigrationVersions`), and a generic `lazyDelegate` helper in `instance.ts` to replace the four hand-written proxy blocks.

**Risk & verification:** this touches every persistence path. Do it as its own branch with no behavior changes; the existing repository/sync/property test suites must pass unchanged, and add adapter-contract tests that run the *same* test suite against both backends (the strongest guard against future drift).

## Phase 4 — Decompose the god files (pattern-alignment, not redesign) — ✅ COMPLETED 2026-07-23 (commit 3ee2120; 4.1/4.3/4.4/4.5)

> 4.1: onboarding-workspace 1000 → 237 lines + hook + 4 step components. 4.2 (pin-lock-context) DEFERRED — the user is actively developing that file; fold in the remaining base64-codec site when doing it.

| # | Target | Problem | Fix |
| --- | --- | --- | --- |
| 4.1 | `components/onboarding-workspace.tsx` (1014 lines) | Only workspace that ignores the codebase's own `use-*-workspace` hook pattern; mixes localStorage draft persistence, step validation, repository orchestration, and 4 steps of JSX | Extract `useOnboardingWorkspace` (draft I/O, `getStepError`, handlers) + split JSX into `ProfileStep` / `AccountStep` / `GoalStep` / `SecurityStep` |
| 4.2 | `lib/security/pin-lock-context.tsx` (~447 lines) | React context owns localStorage key-material persistence, legacy PBKDF2→Argon2id migration, blind-index migration, and unlock/setPin orchestration | Extract React-free `lib/security/key-material-store.ts` (~150 lines out); context becomes UI lifecycle + calls into it. Independently testable key handling |
| 4.3 | `lib/sync/hosted-store.ts:110-272` (`applyHostedSyncPush`, ~160 lines) | Idempotency + validation + 3-way conflict branching, with the HostedRecord→PullRecord literal built 5× | Extract `toPullRecord()` and `resolveConflict(strategy, existing, incoming)`; outer function becomes orchestration |
| 4.4 | `lib/capture/review-queue.ts` | Five unrelated responsibilities in one module | Split into `review-item-factory.ts`, `transaction-factory.ts`, `correction-log.ts` (naturally combines with 1.5 and 2.3) |
| 4.5 | `lib/sync/entity-sync.ts:30-138` | Every syncable entity listed in 3 separate switch/map bodies; forgetting one branch silently no-ops deletes | Single `entityDefinitions: Record<SyncableEntityType, {strategy, upsert, remove}>` map driving all three functions |

## Phase 5 — Lower-priority OCP / polish (opportunistic, bundle with feature work) — ✅ COMPLETED 2026-07-23 (commit 69758a9)

- **Period config table** — collapse 4 `if (period === ...)` chains in `lib/domain/dashboard.ts` into one `PERIOD_CONFIG` lookup.
- **Insight rules as a list** — split `getMonthlyInsights` (`lib/domain/insights.ts:13-109`) into `(ctx) => Insight | null` rule functions; name the magic thresholds.
- **Obligation matcher map** — replace the `sacco_contribution` special-case in `lib/domain/recurring.ts:46-82` with a per-type matcher map; introduce `SuggestedRecurringObligation` type instead of `createdAt: ""` sentinels.
- **Capture source adapters** — replace the four near-identical adapter files with one parameterized factory.
- **Shared UI extractions** — `FormCardShell` (3 forms), `PinInputField` (4 blocks in `backup-panel.tsx`), `useFormSheet` (2 workspaces).

## Phase 6 — Follow-ups (from final review + external review batch)

Done 2026-07-23 (external review batch): onboarding profile-save reordering, atomic per-store rekey writes, `listDefaults` boolean-key fix (JS filter — the index can't hold plaintext boolean keys), savings tone/sign helper, pure `pushDigit` updater, priority-sorted insights, re-key failure rollback in `data-migration.ts`, `StoreName` imports moved to `store-names.ts`.

Remaining, deliberately deferred:
- **4.2 pin-lock-context decomposition** — extract a React-free `key-material-store.ts` (~150 lines), fold the local `base64ToUint8Array` into `codec.ts`. Do when pin-lock feature work quiets down.
- **OAuth prompt ternary** (`google-drive-backup.ts`) — evaluated pre-await; only observable if `signOut` races the first token request. Fold into any future Drive work.
- **U+FFFF literal** (`indexeddb/repository.ts`) — cosmetic; edit-tooling escape-mangling makes the fix riskier than the wart. Leave until that file is next touched.
- **Kotlin `listByField`** — unreachable from TS since Phase 2; remove next time the Android shell is device-tested.

## Sequencing & effort

| Phase | Effort | Risk | Depends on |
| --- | --- | --- | --- |
| 0 — bug fixes | hours | low | — |
| 1 — rule single-sourcing | ~1 day, parallelizable | low (pure refactors, tests exist) | — |
| 2 — dead code | hours | low | — |
| 3 — repository unification | 2–3 days | **medium** — touches all persistence; needs shared-suite contract tests | benefits from 2.5/2.7 landing first |
| 4 — god-file decomposition | 1–2 days | low-medium | 4.2 after 0.2; 4.4 combines with 1.5/2.3 |
| 5 — polish | opportunistic | low | — |

Ground rules for every phase: no behavior changes mixed with refactors; each PR keeps `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green; deletions verified by grep at PR time.
