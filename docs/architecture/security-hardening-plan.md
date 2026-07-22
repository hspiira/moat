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
- ✅ **Phase 1** — `key-hierarchy` (Argon2id + DEK/KEK) shipped with 6 unit tests.
- ✅ **Phase 1b** — wired into the PIN lock with whole-database safe re-keying and legacy PBKDF2 migration; verified end-to-end in a browser (plaintext → encrypted → lock → unlock → plaintext, no data loss).
- ⏳ **Phase 2** — blind indexes (in progress).
- ⏳ **Phase 3** — passkey / WebAuthn-PRF unlock.
- ⏳ **Phase 4** — OPFS + SQLite-WASM engine.

## Phases

- **Phase 0 — Threat model doc.** Write down guarantees and the XSS boundary. *(No code risk.)*
- **Phase 1 — Argon2id + DEK/KEK hierarchy.** New `key-hierarchy` crypto module + tests. Record encryption switches to the DEK.
- **Phase 1b — Wire + migrate.** PIN lock uses the hierarchy. Migrations:
  - *Old PIN users (PBKDF2):* re-derive the old key as extractable, adopt it as the DEK, wrap it with a fresh Argon2id KEK, store v2 material, drop old sentinel. **No record re-encryption** (same key bytes).
  - *No-PIN users (plaintext):* on PIN set, generate a fresh DEK and encrypt all existing plaintext records once.
- **Phase 2 — Encrypt-all + blind indexes.** Move indexed fields to HMAC blind indexes; encrypt everything else. Schema migration re-indexes existing records.
- **Phase 3 — Passkey / WebAuthn-PRF.** Register a passkey with PRF, wrap the DEK with its derived KEK, add biometric unlock with PIN fallback and feature detection.
- **Phase 4 — OPFS + SQLite-WASM (web).** Engine migration behind the existing `RepositoryBundle` interface, with an IndexedDB→SQLite export/import and IndexedDB fallback.

## Non-negotiables

- No data loss: every migration reads before it writes and is resilient to partial failure.
- The app never blocks on an incomplete migration; unreadable records are skipped, not fatal (see [[graceful-failure-handling]]).
- Each phase ships green: typecheck, lint, tests, build.
- Argon2id params are stored per-record-material so cost can be retuned without breaking old material.
