# Moat — Security Hardening Plan

| Field | Value |
|-------|-------|
| Status | Active — in progress |
| Owner | Piira |
| Last updated | 2026-07-22 |

Goal: make local financial data as secure as a browser realistically allows, with **no data loss** for existing users and the app working at every step. Delivered in phases; each phase is independently shippable, tested, and reversible.

## Target architecture

**Key hierarchy (envelope encryption).**
- A random 256-bit **Data Encryption Key (DEK)** encrypts every record (AES-GCM-256). The DEK is generated once and never changes for the life of the data.
- The DEK is **wrapped** (encrypted) by one or more **Key Encryption Keys (KEKs)**, each derived from an unlock method:
  - **PIN/passphrase KEK** — derived with **Argon2id** (memory-hard), not PBKDF2.
  - **Passkey KEK** — derived from a WebAuthn credential via the **PRF extension** (hardware-backed, biometric-gated).
- Both wrapped-DEK blobs are stored. Any unlock method unwraps the same DEK. Changing the PIN or adding a passkey only re-wraps the DEK — records are never re-encrypted.
- Unlock correctness is proven by AES-GCM unwrap succeeding (wrong key → auth-tag failure), so no separate password hash is stored.

**At-rest confidentiality.**
- Every field is inside the ciphertext. The only values kept outside are **blind indexes**: `HMAC(indexKey, value)` for the columns we must query by (userId, month, period, status). This preserves equality lookups with zero plaintext leakage — no readable user ids, dates, or statuses in the raw store.

**Storage engine.**
- Phase 1–3 keep IndexedDB (record ciphertext + blind indexes).
- Phase 4 optionally moves the web engine to **SQLite-WASM on OPFS** to unify with the native SQLite path, with the DB persisted as an encrypted artifact.

## Threat model (summary; full doc: `threat-model.md`)

Protects against: lost/stolen device, another person on an unlocked-then-idle device, and raw at-rest disk/DB access. **Does not** protect against a compromised app origin (XSS) or a malicious build — while unlocked, the DEK is in memory and reachable by any script running on the origin. Mitigations: strict CSP, no third-party scripts, short auto-lock, dependency hygiene.

## Progress

- ✅ **Phase 0** — threat model doc shipped (`threat-model.md`).
- ✅ **Phase 1** — `key-hierarchy` (Argon2id + DEK/KEK) shipped with unit tests.
- ✅ **Phase 1b** — wired into the PIN lock with whole-database safe re-keying and legacy PBKDF2 migration; verified end-to-end in a browser (plaintext → encrypted → lock → unlock → plaintext, no data loss).
- ✅ **Phase 2** — passkey / WebAuthn-PRF unlock; verified e2e with a CDP virtual authenticator (enroll → lock → biometric unlock reads encrypted data).
- ✅ **Phase 3** — **blind indexes** close the metadata leak (see decision below). Index fields become keyed HMACs derived from the DEK; a one-time v1→v2 re-blind runs on unlock. Verified with unit tests and a real-IndexedDB browser round-trip (blinded single + composite lookups return the right records; no plaintext `userId`/month at rest).
- 🔀 **Phase 4 (deferred, needs sign-off)** — SQLite-on-OPFS engine unification. See "Storage engine decision".

### Plan streamlined (2026-07-22)

Blind-indexes-on-IndexedDB and an encrypted-SQLite-file both solve the same problem (metadata leakage). The three security axes:
1. Encryption strength — Argon2id + envelope (done).
2. Unlock method — passkeys (done).
3. Storage/metadata — no plaintext queryable metadata at rest (done via blind indexes).

### Storage engine decision (2026-07-23)

We close the metadata leak with **HMAC blind indexes on IndexedDB**, not a full SQLite-on-OPFS engine swap. Rationale, weighed against the #1 non-negotiable (no data loss):

- The sensitive data (amounts, notes, names, counterparties) is already AES-GCM ciphertext. The *only* remaining plaintext was a small, fixed set of index fields (`userId`, `occurredOn`→month, `period`, `isDefault`, `month`, `status`). Blind indexes turn each into a keyed HMAC, so nothing sensitive is stored in the clear — the same security outcome the SQLite swap targeted.
- Blind indexes never touch record *contents* (untouched ciphertext). A worst-case bug yields an empty read that is detectable and fully recoverable. A SQLite migration bug can **permanently destroy** data.
- The SQLite-on-OPFS path additionally needs app-global COOP/COEP cross-origin isolation (can break image/font/embed loading), a whole-DB cipher (an unvetted community WASM binary — supply-chain tension with the threat model — or a hand-rolled page-cipher VFS, the classic silent-corruption trap), and a from-scratch SQL `RepositoryBundle`. None can be safely verified without interactive data-safety sign-off.

What blind indexes do **not** hide (and SQLite-on-OPFS would): store names, record counts, and record UUIDs. These are structural/low-sensitivity. If we later want them covered — and to unify the web and native SQLite engines — Phase 4 remains available as an explicit, separately-signed-off step (COOP/COEP rollout + WASM cipher acceptance + a non-destructive IndexedDB→SQLite copy that keeps IndexedDB as the source of truth until the copy is verified).

## Phases

- **Phase 0 — Threat model doc.** Write down guarantees and the XSS boundary. *(No code risk.)*
- **Phase 1 — Argon2id + DEK/KEK hierarchy.** New `key-hierarchy` crypto module + tests. Record encryption switches to the DEK.
- **Phase 1b — Wire + migrate.** PIN lock uses the hierarchy. Migrations:
  - *Old PIN users (PBKDF2):* re-derive the old key as extractable, adopt it as the DEK, wrap it with a fresh Argon2id KEK, store v2 material, drop old sentinel. **No record re-encryption** (same key bytes).
  - *No-PIN users (plaintext):* on PIN set, generate a fresh DEK and encrypt all existing plaintext records once.
- **Phase 2 — Passkey / WebAuthn-PRF.** Register a passkey with PRF, wrap the DEK with its derived KEK, add biometric unlock with PIN fallback and feature detection.
- **Phase 3 — Blind indexes.** Index fields become keyed HMACs (`blindIndexValue`, namespaced per store+field) derived from the DEK via HKDF (`info: "moat/blind-index/v1"`). Envelope version bumps to 2; existing v1 records are re-blinded once on unlock (`reblindAllRecords`, guarded by `moat:blind_index_version`). Queries hash their arguments the same way (`indexQueryKey`); `transactions.listByMonth` switches from a plaintext range to an exact blinded-month match; plaintext-mode (no-PIN) users keep raw index values.
- **Phase 4 (deferred) — OPFS + SQLite-WASM (web).** Engine unification behind `RepositoryBundle`, with a non-destructive IndexedDB→SQLite copy and IndexedDB fallback. Deferred pending sign-off — see "Storage engine decision".

## Non-negotiables

- No data loss: every migration reads before it writes and is resilient to partial failure.
- The app never blocks on an incomplete migration; unreadable records are skipped, not fatal (see [[graceful-failure-handling]]).
- Each phase ships green: typecheck, lint, tests, build.
- Argon2id params are stored per-record-material so cost can be retuned without breaking old material.
