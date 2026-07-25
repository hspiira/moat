# Capture parser hardening — design

**Date:** 2026-07-25
**Status:** Approved (design), pending implementation plan
**Scope owner:** Henry Piira
**Follows:** [2026-07-25-capture-fee-extraction-design.md](2026-07-25-capture-fee-extraction-design.md)

## Problem

An audit of 11 real MTN, Airtel, Absa, and Centenary SMS messages (supplied by the
user) against the current parsers revealed systemic failures:

1. **Payee is garbage on every provider-matched message** — the `(.+?)…$` capture
   greedily swallows the whole message tail (e.g. payee = *"MILLY NAKIRANDA,
   256785363402 on 2026-06-27 16:56:59, fee: 0. … 500MBs."*).
2. **Provider coverage gaps** — MTN withdrawals, Airtel `PAID.TID` / `Cash deposit`,
   Absa ATM withdrawals, and Centenary `trxn of …` all fall through to the generic
   parser, which:
   - **drops the fee** (MTN withdrawal fee+tax of 1,750 lost — the exact case the fee
     feature exists for),
   - **defaults the date to today** for named-month formats (`23-July-2026`),
   - **misreads the Centenary credit**: `+1,790,590` income parsed as a `-179,059`
     expense (wrong sign, amount truncated by the generic grouping regex).
3. **The MTN pre-authorization SMS** ("you have requested a withdrawal… authorize the
   transaction") would create a phantom transaction, double-counting once the real
   "You have withdrawn…" confirmation arrives.

## Decision

Harden the provider parsers so all 11 real messages extract correct
type/amount/fee/date/payee, using the messages as regression fixtures. Add Absa and
Centenary as dedicated providers; extend MTN and Airtel; add shared helpers for
named-month dates and bounded payees. Pre-authorization messages return `null`.

## Design

### Shared helpers (`lib/capture/providers/shared.ts`, `lib/capture/normalizers.ts`)

- **`toIsoDate`** (shared.ts) and **`parseCaptureDate`** (normalizers.ts): add a
  named-month branch so `23-July-2026` → `2026-07-23`. Map month names (full and
  3-letter) case-insensitively.
- **`cleanCapturePayee(raw: string): string`** (new, shared.ts): truncates a raw
  payee capture at the first real delimiter — ` on `, `. `, ` Fee`, ` Tax`, a
  newline, or `, ` followed by digits — then trims trailing punctuation. Turns
  *"MILLY NAKIRANDA, 256785363402 on …"* into *"MILLY NAKIRANDA, 256785363402"* and
  *"256703442862, HENRYSSEKIBO. Fee:…"* into *"256703442862, HENRYSSEKIBO"*.
- **`parseCaptureFee`** returns `undefined` when the summed total is `0` (so
  "fee: 0" yields no fee), not `0`.

### MTN (`lib/capture/providers/mtn-uganda.ts`)

- **Pre-auth guard first:** if the text matches `/you have requested|authorize the
  transaction/i`, return `null`.
- **Withdrawal (new):** `You have withdrawn UGX <amt> on <date>. Fee: UGX <fee>,
  Tax: UGX <tax>…` → `type: "expense"`, `feeAmount: parseCaptureFee(text)` (sums
  Fee + Tax = 1,750), `payee: "Cash withdrawal"`, date extracted.
- **Incoming / outgoing:** keep the regexes, but run the payee capture through
  `cleanCapturePayee`.

### Airtel (`lib/capture/providers/airtel-money-uganda.ts`)

- **Cash deposit (new):** `Cash deposit of UGX <amt> from <payee>. Balance … Date
  <date>.` → `type: "income"`, payee cleaned.
- **PAID.TID (new):** `PAID.TID <id>. UGX <amt> to <payee> … Charge UGX <fee>. Bal
  … <date>` → `type: "expense"`, `feeAmount: parseCaptureFee` (Charge 0 → undefined),
  payee cleaned (e.g. "Data bundle").
- **Incoming / outgoing:** keep, run payee through `cleanCapturePayee`.

### Absa (`lib/capture/providers/absa-uganda.ts` — new)

- `Absa confirms an ATM cash Withdrawal of UGX <amt> on Acc. ending <acct> on
  <date> at <time>…` → `type: "expense"`, `payee: "ATM cash withdrawal"`, no fee,
  date `dd/mm/yyyy`.

### Centenary (`lib/capture/providers/centenary-uganda.ts` — new)

- `CENTENARY: … a trxn of <±amt> on your A/C <acct> on <date> at <time>. Bal:<bal>
  (<description>).` → sign of the amount sets type (`-` → expense, `+`/none →
  income), `originalAmount` is the absolute value (comma-safe via `parseAmount`),
  `payee` is the parenthetical `<description>` cleaned, date `dd-mm-yyyy`.

### Registration (`lib/capture/providers/index.ts`)

Add `parseAbsaUgandaMessage` and `parseCentenaryUgandaMessage` to `providerParsers`
**before** `parseBankAlertGeneric` (specific before generic). MTN/Airtel stay first.

### Generic fallback

`bank-alert-generic.ts` stays as the catch-all for unrecognized banks. No behavior
change beyond optionally routing its payee through `cleanCapturePayee`.

## Testing

A fixture test (`lib/capture/providers/real-messages.test.ts`) drives all 11 real
messages through `parseCaptureText` and asserts type/amount/fee/date/payee per the
table below. Each provider task also unit-tests its own parser directly.

| Message | type | amount | fee | payee | date |
|---|---|---|---|---|---|
| MTN sent (fee 0) | expense | 41410 | — | MILLY NAKIRANDA, 256785363402 | 2026-06-27 |
| MTN sent (fee 100) | expense | 5000 | 100 | 256703442862, HENRYSSEKIBO | (today) |
| MTN interest | income | 85 | — | MTN MoMo INTEREST PAYOUT | 2026-07-17 |
| MTN received | income | 100000 | — | Centenary Bank | 2026-06-27 |
| MTN withdrawal | expense | 50000 | 1750 | Cash withdrawal | 2026-06-27 |
| MTN pre-auth | (null) | — | — | — | — |
| Airtel PAID | expense | 1000 | — | Data bundle | 2026-07-23 |
| Airtel deposit | income | 10000 | — | SARAH | 2026-07-23 |
| Absa ATM | expense | 100000 | — | ATM cash withdrawal | 2026-07-14 |
| Centenary debit | expense | 36000 | — | Funds Transfer (Mobile) /Ebanking | 2026-07-06 |
| Centenary credit | income | 1790590 | — | EFT-ORDER MINET UGANDA INSURANCE BROKERS/Head Office | 2026-07-24 |

Existing parser/pipeline tests must stay green.

## Success criteria

- All 11 fixtures pass with correct type/amount/fee/date/payee.
- The MTN withdrawal fee (1,750) and Centenary credit sign/amount are correct.
- The pre-auth message yields no candidate.
- `tsc --noEmit`, `lint`, `test`, `build` all green.

## Out of scope

- Perfect human-name extraction from MoMo's inconsistent "name, number" ordering —
  `cleanCapturePayee` gets a clean, useful payee, not a normalized name.
- New providers beyond MTN / Airtel / Absa / Centenary / generic.
