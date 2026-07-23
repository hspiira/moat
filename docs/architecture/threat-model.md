# Moat — Threat Model

| Field | Value |
|-------|-------|
| Status | Active |
| Owner | Piira |
| Last updated | 2026-07-22 |

Moat is a local-first personal finance app. Financial records are stored and encrypted **on the user's device**; there is no server that holds plaintext. This document states what that protects against and — just as importantly — what it does not.

## Assets

- Financial records: accounts, balances, transactions, goals, budgets, capture inbox.
- The unlock secrets: the PIN/passphrase and any registered passkey.
- Derived keys: the Data Encryption Key (DEK) and Key Encryption Keys (KEKs).

## What Moat protects against

1. **Lost or stolen device.** Records are encrypted at rest with the DEK. The DEK is only recoverable by unwrapping it with a KEK derived from the PIN (via Argon2id) or a passkey (via WebAuthn PRF). Without the PIN or the device's authenticator, the raw store yields only ciphertext.
2. **Shared or briefly-unattended device.** A 5-minute inactivity auto-lock clears the DEK from memory and re-shows the PIN screen. Unlock attempts are throttled with an escalating lockout, so a 6-digit PIN can't be brute-forced interactively.
3. **At-rest / disk inspection.** Every field lives inside the ciphertext; only blind indexes (`HMAC(indexKey, value)`) sit outside, so an attacker reading the raw IndexedDB/DB file sees no user ids, dates, amounts, or statuses in the clear.
4. **Offline brute-force of the store.** Argon2id (memory-hard) makes guessing the PIN against a stolen store far more expensive than a plain hash; a passphrase raises this further.

## What Moat does NOT protect against (explicit boundaries)

1. **A compromised app origin (XSS) or a malicious build.** Any JavaScript running on Moat's origin while the app is **unlocked** can read the in-memory DEK and therefore all data. This is a fundamental limit of in-browser client-side encryption. Mitigations, not guarantees: a strict Content-Security-Policy, no third-party/analytics scripts, minimal audited dependencies, and the short auto-lock window. This is why Moat ships no ad/analytics SDKs.
2. **A compromised device OS / malware / keylogger.** If the platform itself is compromised, PIN entry and memory are exposed. Out of scope for an app-level control.
3. **Physical coercion / shoulder-surfing the PIN.** Out of scope.
4. **Backup handling by the user.** Encrypted `.enc` backups are safe to store anywhere; a plaintext JSON export (a deliberate, user-initiated option) is the user's responsibility.

## Key design decisions that follow from this model

- Keys are non-extractable where the design allows; the DEK is held in memory only while unlocked and cleared on lock.
- Unlock verification is by successful AES-GCM unwrap (wrong key → auth-tag failure); no password hash is stored that could be attacked separately.
- There is **no key escrow or recovery service**. If the user forgets the PIN and has no passkey and no backup, the data is unrecoverable — this is the correct trade-off for a no-server model, and the UI states it plainly.
- Sensitive operations (export, delete) are user-initiated and, where destructive, confirmed.

## Open follow-ups

- Ship a strict CSP header set for the deployed app.
- Consider a passphrase option for users who want entropy beyond a 6-digit PIN.
- Periodic dependency audit; keep the third-party surface minimal.
