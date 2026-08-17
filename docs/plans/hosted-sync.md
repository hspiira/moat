# Moat — Hosted Sync Implementation Plan

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Implementation plan — phases 1, 2 and 4 landed 2026-08-17 |
| Owner | Piira |
| Last Updated | 2026-08-17 |
| Scope | Moving from local-only storage to an optional, end-to-end encrypted hosted database |

Status claims live in [tracker.md](../tracker.md). Sections below describe the plan as written on 2026-08-17; see [Where this stands](#where-this-stands) at the end for what has since landed.

## Summary

Moat's client-side sync engine was built and tested; the server side did not exist in any deployable form. This plan closes that gap under two decisions taken on 2026-08-17:

1. **The server stores end-to-end encrypted blobs.** It never holds readable financial data.
2. **Accounts are optional.** Local-only remains the default and requires no signup. Creating an account is what unlocks hosted sync.

Those two decisions are load-bearing. Both change the wire contract before any database work begins, and one of them exposes a latent bug in the current contract that would surface immediately on a real backend.

## Starting position

### What exists and does not need rewriting

| Piece | Location |
| --- | --- |
| Outbox enqueue on every syncable write | [lib/repositories/shared.ts](../../lib/repositories/shared.ts) |
| Push and pull engine with retry and conflict mapping | [lib/sync/engine.ts](../../lib/sync/engine.ts) |
| Per-entity conflict strategies across 14 entity types | [lib/sync/entity-sync.ts](../../lib/sync/entity-sync.ts) |
| Wire contract and request validation | [lib/sync/server-contract.ts](../../lib/sync/server-contract.ts) |
| Settings panel and manual-review conflict queue | [components/settings/sync-mode-panel.tsx](../../components/settings/sync-mode-panel.tsx) |
| Envelope key hierarchy: one DEK, many KEK wraps | [lib/security/key-hierarchy.ts](../../lib/security/key-hierarchy.ts) |

The key hierarchy deserves emphasis. It already implements exactly the structure end-to-end encrypted sync requires: a single random AES-GCM-256 DEK encrypts every record, and that DEK is wrapped independently by a PIN-derived KEK (Argon2id) and a passkey-derived KEK (WebAuthn PRF). Adding an unlock method re-wraps the DEK and never re-encrypts records. Extending this to a second device is a new wrap, not a new crypto design.

### What did not exist, as of 2026-08-17

- No database driver, ORM, or `DATABASE_URL`. Nothing in `package.json`.
- No deployed API. [next.config.ts](../../next.config.ts) sets `output: "export"`, so the build produces static files and cannot host route handlers. The old files under `server/sync/` were not in `app/`, were imported by nothing, and shipped nowhere. They typechecked only because `tsconfig.json` includes `**/*.ts`.
- No authentication. `userId` is read from the request body and trusted. The token is a single shared secret.
- The "hosted store" was `.moat-sync/hosted-sync.json`, a committed JSON file with test fixtures in it.

The first two are now addressed. Authentication is not.

## Contract changes required before server work

These are prerequisites. Building the database first would mean rebuilding it.

### 1. Optimistic concurrency tokens

This is the most important item in this plan.

The server currently decides whether a push conflicts by comparing payloads:

```ts
const sameAsServer = existing && existing.deleted === deleted && existing.payload === payload;
if (!existing || sameAsServer) { /* accept */ }
return resolveConflict(/* ... */);   // manual_review => conflict
```

Two problems follow.

**Under end-to-end encryption this check can never succeed.** AES-GCM uses a random IV per encryption, so the same plaintext produces different ciphertext every time. `existing.payload === payload` is false on every push against an existing record. Every entity marked `manual_review`, which is most of the ledger, would raise a conflict on every single edit.

**The check is already wrong today, before encryption.** A user with one device who edits an already-synced transaction sends a payload that legitimately differs from the server's copy. There is no divergence, just a newer version. The server has no way to tell those apart, so it raises a manual-review conflict against the user's own prior write.

The fix is standard optimistic concurrency, and it is absent from the contract. `SyncPushRequest` items carry `outboxId`, `entityType`, `entityId`, `operation`, `payload`, and `queuedAt`. There is no field for the version the edit was based on.

Required changes:

- Add `baseVersionToken?: string` to push items in [lib/sync/types.ts](../../lib/sync/types.ts).
- Persist `serverVersionToken` on the local record whenever a push succeeds or a pull applies. The outbox item currently keeps `conflictPayload` but never retains the version it saw.
- Server logic becomes: no existing record, or `baseVersionToken` matches the stored token, means accept and issue a new token. A mismatch means genuine divergence, so apply the configured strategy. Absent token on an existing record means treat as divergence.

This must be settled before the schema is written, because `server_version_token` becomes the concurrency column.

### 2. Remove server-side payload inspection

[lib/sync/hosted-store.ts](../../lib/sync/hosted-store.ts) parses each upsert payload and rejects it when the embedded `id` does not match `entityId`. Ciphertext cannot be parsed. That invariant moves client-side, enforced before encryption in `enqueueSyncMutation`.

### 3. A sync-specific encryption envelope

The at-rest envelope in [lib/security/record-crypto.ts](../../lib/security/record-crypto.ts) is shaped for IndexedDB, carrying blind-index metadata fields so local queries work. Sync payloads need their own versioned envelope with no queryable metadata at all:

```
{ v: 1, dekId: string, iv: base64, ciphertext: base64 }
```

`dekId` matters for the same reason envelope versioning matters at rest. If a DEK is ever rotated or a second one is introduced, the server will hold a mix, and a client needs to know which key a blob wants without trial decryption.

### 3a. Record ids (settled 2026-08-17)

Ids are bare cuid2. Records the app seeds for every user derive theirs from
the user id and a fixed slug, listed in
[lib/domain/seeded-ids.ts](../../lib/domain/seeded-ids.ts), so two devices
compute the same id and sync merges the defaults instead of duplicating them.
Existing records are renumbered by
[lib/app-state/id-migration.ts](../../lib/app-state/id-migration.ts) at opt-in,
before anything is pushed.

The derivation is written out rather than taken from a dependency, and its
outputs are pinned in a test, because a derived id that shifts creates a
duplicate of a record the device already has.

### 4. Audit what stays in plaintext

Under this design the server sees `userId` (or its account equivalent), `entityType`, `entityId`, timestamps, and blob sizes. It should see nothing else.

Entity ids are overwhelmingly `crypto.randomUUID()` based and leak nothing. Two exceptions need checking before launch:

Both of the concerns originally listed here are now resolved: ids are cuid2, so none of them carries a name, a slug, or a period. Seeded ids are derived per user, so the same default has a different id for every user and reveals nothing by comparison across accounts.

Timing and volume metadata remain visible regardless. That is inherent to the model and should be stated in the privacy copy rather than papered over.

## Key transport: the new crux

With server-readable storage, adding a device is an authentication problem. With end-to-end encryption it is a key distribution problem, and that is the genuinely hard part of this plan.

The DEK must reach the second device without the server ever seeing it.

### The trap to avoid

**Do not store a PIN-wrapped DEK on the server.** The PIN policy is a six-digit minimum, giving at most 10^6 candidates. Once an attacker holds the wrapped blob, they can grind it offline. Argon2id at 46 MiB and three iterations is tuned to make interactive unlock comfortable on a mid-range phone, which is precisely the property that makes it insufficient against a million-candidate offline search. The PIN is a fine local unlock because the blob never leaves the device. It is not a fine transport secret.

Anything the server stores must be wrapped under a high-entropy KEK.

### Recommended approach

**Primary: recovery phrase.** At sync opt-in, generate a high-entropy phrase, show it once, require the user to confirm it. Derive a KEK from it via Argon2id and store only that wrap server-side. A new device signs in, enters the phrase, pulls the wrap, and unwraps the DEK locally. The server holds ciphertext at every step.

This handles the case the tracker actually calls out under device migration: the old phone is lost, broken, or sold. A pairing flow cannot help there because it needs both devices working.

**Secondary, later: device pairing.** A QR code carrying the DEK over a local channel, with both devices present. Faster and friendlier when it applies, but it is a convenience path, not the foundation.

**Passkey PRF** already wraps the DEK locally and syncs across a platform ecosystem in some configurations. It is worth exploring as a third method, but I am not certain enough about cross-device PRF behaviour across Android, iOS, and browser password managers to plan around it. It needs a spike before it appears in a plan.

### The consequence to state plainly

Lose the recovery phrase and every device, and the cloud copy is unrecoverable. That is not a flaw in the design, it is what end-to-end encryption means. It must be surfaced in the opt-in flow in plain language, not buried. Support cannot recover data, and the product should never imply otherwise.

## Phases

### Phase 0: contract and design

Amend [architecture/sync.md](../architecture/sync.md) with the version-token protocol, the encryption envelope, the plaintext-metadata inventory, and the key transport design. Land the `baseVersionToken` changes in [lib/sync/types.ts](../../lib/sync/types.ts) and the client, with tests, against the existing dev stub. The stub is useful here precisely because it is cheap to change.

Exit criteria: the spurious single-device conflict described above is reproduced in a test and then fixed.

### Phase 1: separate the deployable

Move [server/sync/](../../server/sync/) into its own package with its own `package.json`. The static-export web build cannot host the API, so this is not optional. Note that the untracked `pnpm-workspace.yaml` in the repo root only carries pnpm build approvals, so there is no workspace to join yet; one has to be declared.

The handlers also have to stop using `next/server`. `NextRequest` and `NextResponse` only exist inside Next, so whatever runtime hosts the API needs plain request and response handling instead.

Add a health endpoint. Right now a misconfigured sync URL fails as an opaque fetch error surfaced through the settings panel. It should fail loudly and specifically.

### Phase 2: the database

Postgres. Schema mirrors the contract:

- `accounts` (the optional user account, not financial accounts; the naming collision is worth avoiding early, perhaps `sync_users`)
- `devices`
- `sync_records`: tenancy key, entity_type, entity_id, ciphertext, dek_id, deleted, updated_at, server_version_token
- `applied_outbox_ids` for idempotency
- `key_wraps`: the recovery-phrase-wrapped DEK

Two things the current implementation gets wrong that must not be carried over:

- **Concurrency.** `hosted-store.ts` does read-modify-write on a whole JSON file with no locking, and says so in its own header. The Postgres version needs the push handled in a transaction with `SELECT ... FOR UPDATE` on the record key.
- **Tenancy.** Enforce it in the database with row-level security keyed on the authenticated identity, not only in application code. `userId` from the request body must stop being trusted at the same commit the database lands.

### Phase 3: authentication and hardening

Optional account creation, sign-in, device registration and revocation, rate limiting, payload size caps, structured audit logging. Then a threat-model review, which [tracker.md](../tracker.md) already names as a prerequisite before hosted sync is offered to anyone.

### Phase 4: client gaps

Done, except the last item.

- **Backfill on opt-in.** Landed in `lib/sync/backfill.ts`. Walks every syncable store, seeds the outbox, reports progress, and resumes rather than double-queueing if interrupted.
- **Pull pagination.** Landed. Keyset cursor pairing `updatedAt` with the entity key, in `lib/sync/cursor.ts`, used by both stores.
- **Push batching.** Not in the original list, but backfill made it necessary: a first sync would otherwise put thousands of records in one request body. Batched at 200.
- **Pull without push.** Also not in the original list. `runHostedSync` returned early when the outbox was empty, so a device with no local changes never received anything from other devices. Fixed.
- **Endpoint configuration.** Still outstanding. The sync URL is a free-text field the user types into settings.

## Open questions

- Where is the server hosted, and does data residency matter for Ugandan users? Uganda's Data Protection and Privacy Act (2019) is likely to apply to hosted personal financial data. I do not have a verified current reference for its data controller registration or cross-border transfer requirements, and this should be checked with a local advisor rather than inferred. End-to-end encryption reduces this exposure substantially but does not eliminate the obligations, since account identifiers and metadata are still personal data.
- Does the recovery phrase get an optional encrypted escrow, or is loss always terminal? Terminal is the honest default and the one this plan assumes.
- Should conflicts remain manual-review for all ledger entities once version tokens land? Several may become safely automatic when the server can distinguish a newer version from a divergent one, which would meaningfully reduce how often users see the conflict queue.

## Where this stands

Landed on 2026-08-17:

- Phase 1, the server is a real deployable at `server/`, a standalone Node service. The old handlers under `server/sync/` were deleted; they imported `next/server` and shipped nowhere.
- Phase 2, Postgres. Schema, migration, transactional push with `for update` row locks in entity-key order, and row-level tenancy on `moat.user_id`.
- Phase 4, backfill and pull paging, plus push batching and pull-without-push.

Still open, in the order that matters:

1. **Client-side version tokens.** The server accepts `baseVersionToken` and the schema has the column, so the server half of Phase 0 is done. The client does not yet persist the token per record, so it still falls back to payload comparison, which means editing an already-synced record is reported as a conflict. This is the single highest-value remaining fix.
2. **Per-user authentication.** Phase 3. One shared bearer token is not identity, and `userId` is still trusted from the request body.
3. **End-to-end encryption.** The decision is made but no code implements it. Payloads are plaintext on the wire today.
4. **Recovery phrase and key transport.** Nothing built.

Note that the Postgres schema was written before client-side version tokens exist. That was a deliberate call: `server_version_token` is already in the contract and the column is in place, so adding the client half later needs no migration.
