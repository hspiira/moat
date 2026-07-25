# Capture Parser Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MTN, Airtel, Absa, and Centenary SMS parsers extract correct type/amount/fee/date/payee from 11 real messages, fixing garbage payees, dropped fees, wrong signs, mangled amounts, and named-month dates.

**Architecture:** Per-provider parsers return a `CaptureProviderResult`; the pipeline falls back to generic normalizers for date/payee when a provider omits them. This plan bounds the payee capture, adds named-month date parsing, adds MTN-withdrawal and Airtel `PAID.TID`/`Cash deposit` formats, and adds dedicated Absa and Centenary providers. Pre-authorization messages return `null`.

**Tech Stack:** TypeScript strict, Vitest.

## Global Constraints

- Commit with NO Claude affiliation: `git -c commit.gpgsign=false commit --no-verify -m "…"`. Author is Henry Piira.
- Gate every task: `npx tsc --noEmit && npm run lint && npm run test`. Run `npm run build` before the final commit.
- Fees are UGX; `parseCaptureFee` returns `undefined` for a zero total.
- Do not regress existing parser/pipeline tests.
- Provider order in `index.ts`: MTN, Airtel, Absa, Centenary, then generic (specific before generic).

---

### Task 1: Shared helpers — bounded payee, named-month dates, zero-fee

**Files:**
- Modify: `lib/capture/providers/shared.ts` (`cleanCapturePayee`, named-month in `toIsoDate`, `parseCaptureFee` zero→undefined)
- Modify: `lib/capture/normalizers.ts` (named-month in `parseCaptureDate`)
- Test: `lib/capture/providers/shared.test.ts` (extend)

**Interfaces:**
- Produces: `cleanCapturePayee(raw: string): string`; `toIsoDate` handles `23-July-2026`; `parseCaptureFee` returns `undefined` for total 0.

- [ ] **Step 1: Write the failing tests**

Append to `lib/capture/providers/shared.test.ts`:

```ts
import { cleanCapturePayee, toIsoDate } from "./shared";

describe("cleanCapturePayee", () => {
  it("cuts the greedy tail at the first real delimiter", () => {
    expect(
      cleanCapturePayee("MILLY NAKIRANDA, 256785363402 on 2026-06-27 16:56:59, fee: 0."),
    ).toBe("MILLY NAKIRANDA");
    expect(cleanCapturePayee("256703442862, HENRYSSEKIBO. Fee:UGX 100.00.")).toBe(
      "256703442862, HENRYSSEKIBO",
    );
    expect(cleanCapturePayee("MTN MoMo INTEREST PAYOUT on 2026-07-17 23:23:11.")).toBe(
      "MTN MoMo INTEREST PAYOUT",
    );
    expect(cleanCapturePayee("Centenary Bank . on 2026-06-27 09:25:41.")).toBe("Centenary Bank");
  });
});

describe("toIsoDate named month", () => {
  it("parses dd-Month-yyyy", () => {
    expect(toIsoDate("23-July-2026")).toBe("2026-07-23");
    expect(toIsoDate("05-Jan-2026")).toBe("2026-01-05");
  });
});

describe("parseCaptureFee zero", () => {
  it("returns undefined when the total is zero", () => {
    expect(parseCaptureFee("Fee: 0")).toBeUndefined();
    expect(parseCaptureFee("Mobile App Charge UGX 0")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/capture/providers/shared.test.ts`
Expected: FAIL — `cleanCapturePayee` not exported; named-month + zero-fee not handled.

- [ ] **Step 3: Implement in `shared.ts`**

Add a month map and the payee helper, and update `toIsoDate` and `parseCaptureFee`.

```ts
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function cleanCapturePayee(raw: string): string {
  return raw
    .split(/\s+on\s|\.\s|\s*\bFee\b|\s*\bTax\b|\n|,\s*(?=\d)/i)[0]
    .trim()
    .replace(/[.,\s]+$/, "");
}
```

In `toIsoDate`, before the final `return undefined;`, add:

```ts
  const named = value.match(/(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](20\d{2})/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, "0")}`;
  }
```

Change the last line of `parseCaptureFee` from `return found ? total : undefined;` to:

```ts
  return found && total > 0 ? total : undefined;
```

(The `found` flag can be dropped if unused; `total > 0` is sufficient — keep whichever keeps lint happy.)

- [ ] **Step 4: Add named month to the generic `parseCaptureDate`**

In `lib/capture/normalizers.ts`, inside `parseCaptureDate`, before the final
`return new Date().toISOString().slice(0, 10);`, add:

```ts
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const named = text.match(/\b(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](20\d{2})\b/);
  if (named) {
    const month = months[named[2].slice(0, 3).toLowerCase()];
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, "0")}`;
  }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/capture/providers/shared.test.ts`
Expected: PASS.

- [ ] **Step 6: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/capture/providers/shared.ts lib/capture/normalizers.ts lib/capture/providers/shared.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Add bounded payee, named-month dates, zero-fee helpers"
```

---

### Task 2: MTN — pre-auth skip, withdrawal, bounded payees

**Files:**
- Modify: `lib/capture/providers/mtn-uganda.ts`
- Modify: `lib/capture/normalizers.ts` (`isNonTransactionalMessage`)
- Modify: `lib/capture/pipeline.ts` (filter non-transactional messages)
- Test: `lib/capture/providers/mtn-uganda.test.ts` (create)
- Test: `lib/capture/pipeline.test.ts` (extend)

**Interfaces:**
- Consumes: `cleanCapturePayee`, `parseCaptureFee`, `toIsoDate` (Task 1).
- Produces: `isNonTransactionalMessage(text: string): boolean`.

**Why both levels:** the MTN provider returning `null` only means "not an MTN
transaction" — the pipeline's generic fallback would still mint a phantom expense
from a pre-auth message. So the pipeline must drop non-transactional messages
outright, producing no candidate at all.

- [ ] **Step 1: Write the failing test**

Create `lib/capture/providers/mtn-uganda.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseMtnUgandaMessage } from "./mtn-uganda";

describe("parseMtnUgandaMessage", () => {
  it("skips pre-authorization requests", () => {
    expect(
      parseMtnUgandaMessage(
        "Y'ello. You have requested a withdrawal of UGX 50,000 from ROGERS SSEWAGUDDE . Dial *165# and select My Approvals to authorize the transaction.The total fee is  UGX 1,750 inclusive of 0.5 percent tax.Transaction ID 10173656344",
      ),
    ).toBeNull();
  });

  it("parses a withdrawal with fee + tax summed", () => {
    const r = parseMtnUgandaMessage(
      "You have withdrawn UGX 50,000 on 2026-06-27 09:35:56. Fee: UGX 1,500, Tax: UGX 250. New balance: UGX 50,363.01. Download MoMo App http://bit.ly/3KGlEJJ to get 500MBs",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(50000);
    expect(r?.feeAmount).toBe(1750);
    expect(r?.payee).toBe("Cash withdrawal");
    expect(r?.occurredOn).toBe("2026-06-27");
  });

  it("bounds the payee on an outgoing send", () => {
    const r = parseMtnUgandaMessage(
      "You have sent UGX 41410 to MILLY NAKIRANDA, 256785363402 on 2026-06-27 16:56:59, fee: 0. Reason: . New balance: 8953. ID :41669823701.",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(41410);
    expect(r?.feeAmount).toBeUndefined();
    expect(r?.payee).toBe("MILLY NAKIRANDA");
  });

  it("bounds the payee on an incoming receipt", () => {
    const r = parseMtnUgandaMessage(
      "You have received UGX 100000 from Centenary Bank . on 2026-06-27 09:25:41. fee:0. Reason: . New balance: UGX 102113.",
    );
    expect(r?.type).toBe("income");
    expect(r?.payee).toBe("Centenary Bank");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/capture/providers/mtn-uganda.test.ts`
Expected: FAIL — pre-auth not skipped, withdrawal unmatched, payee unbounded.

- [ ] **Step 3: Rewrite `mtn-uganda.ts`**

```ts
import type { CaptureProviderResult } from "@/lib/capture/types";
import {
  cleanCapturePayee,
  normalizeCurrency,
  parseAmount,
  parseCaptureFee,
  toIsoDate,
} from "@/lib/capture/providers/shared";

export function parseMtnUgandaMessage(text: string): CaptureProviderResult | null {
  // Pre-authorization requests are not completed transactions.
  if (/you have requested|authorize the transaction/i.test(text)) {
    return null;
  }

  const incoming = text.match(
    /received\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)\s+from\s+(.+?)(?:\s+on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i,
  );
  if (incoming) {
    return {
      providerId: "mtn-uganda",
      parserLabel: "mtn-incoming",
      type: "income",
      currency: normalizeCurrency(incoming[1]),
      originalAmount: parseAmount(incoming[2]),
      payee: cleanCapturePayee(incoming[3] ?? ""),
      occurredOn: toIsoDate(incoming[4]),
      note: text,
      confidenceBoost: 0.35,
    };
  }

  const withdrawal = text.match(
    /withdrawn\s+(UGX|USh)\s*([0-9,]+(?:\.[0-9]+)?)\s+on\s+(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i,
  );
  if (withdrawal) {
    return {
      providerId: "mtn-uganda",
      parserLabel: "mtn-withdrawal",
      type: "expense",
      currency: normalizeCurrency(withdrawal[1]),
      originalAmount: parseAmount(withdrawal[2]),
      payee: "Cash withdrawal",
      occurredOn: toIsoDate(withdrawal[3]),
      note: text,
      feeAmount: parseCaptureFee(text),
      confidenceBoost: 0.35,
    };
  }

  const outgoing = text.match(
    /(?:paid|sent)\s+(UGX|USh|USD|KES|TZS|RWF|EUR|GBP)\s*([0-9,]+(?:\.[0-9]+)?)\s+to\s+(.+?)(?:\s+on\s+(\d{2}[-/]\d{2}[-/]\d{4}|\d{4}[-/]\d{2}[-/]\d{2}))?$/i,
  );
  if (outgoing) {
    return {
      providerId: "mtn-uganda",
      parserLabel: "mtn-outgoing",
      type: "expense",
      currency: normalizeCurrency(outgoing[1]),
      originalAmount: parseAmount(outgoing[2]),
      payee: cleanCapturePayee(outgoing[3] ?? ""),
      occurredOn: toIsoDate(outgoing[4]),
      note: text,
      feeAmount: parseCaptureFee(text),
      confidenceBoost: 0.3,
    };
  }

  return null;
}
```

- [ ] **Step 4: Run to verify the MTN unit test passes**

Run: `npx vitest run lib/capture/providers/mtn-uganda.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing pipeline-skip test**

Append to `lib/capture/pipeline.test.ts` (inside the existing `describe`):

```ts
  it("produces no candidate for a pre-authorization message", () => {
    const envelope = createNotificationEnvelope({
      userId: "u1",
      rawContent:
        "Y'ello. You have requested a withdrawal of UGX 50,000 from ROGERS SSEWAGUDDE . Dial *165# and select My Approvals to authorize the transaction.The total fee is  UGX 1,750 inclusive of 0.5 percent tax.Transaction ID 10173656344",
      sourceApp: "com.mtn.uganda.momo",
    });

    const rows = parseCaptureEnvelope({
      envelope,
      source: "notification",
      accountId: "account:bank",
      categories,
      existingTransactions: [] as Transaction[],
    });

    expect(rows).toHaveLength(0);
  });
```

Run: `npx vitest run lib/capture/pipeline.test.ts` → Expected: FAIL (one row is produced).

- [ ] **Step 6: Add `isNonTransactionalMessage` and filter in the pipeline**

In `lib/capture/normalizers.ts`, add:

```ts
export function isNonTransactionalMessage(text: string): boolean {
  return /you have requested|authorize the transaction/i.test(text);
}
```

In `lib/capture/pipeline.ts`, import it:

```ts
import {
  inferCaptureCurrency,
  inferCapturePayee,
  inferCaptureType,
  isNonTransactionalMessage,
  parseCaptureAmount,
  parseCaptureDate,
  splitCaptureMessages,
} from "@/lib/capture/normalizers";
```

and drop those messages before mapping. Change:

```ts
  const messages = splitCaptureMessages(input.envelope.rawContent);

  return messages.map<CapturePipelineCandidate>((rawText, index) => {
```
to:
```ts
  const messages = splitCaptureMessages(input.envelope.rawContent).filter(
    (rawText) => !isNonTransactionalMessage(rawText),
  );

  return messages.map<CapturePipelineCandidate>((rawText, index) => {
```

- [ ] **Step 7: Run to verify both pass**

Run: `npx vitest run lib/capture/providers/mtn-uganda.test.ts lib/capture/pipeline.test.ts`
Expected: PASS.

- [ ] **Step 8: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/capture/providers/mtn-uganda.ts lib/capture/providers/mtn-uganda.test.ts lib/capture/normalizers.ts lib/capture/pipeline.ts lib/capture/pipeline.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Harden MTN parser and skip pre-authorization messages"
```

---

### Task 3: Airtel — Cash deposit, PAID.TID, bounded payees

**Files:**
- Modify: `lib/capture/providers/airtel-money-uganda.ts`
- Test: `lib/capture/providers/airtel-money-uganda.test.ts` (create)

**Interfaces:**
- Consumes: `cleanCapturePayee`, `parseCaptureFee` (Task 1).

- [ ] **Step 1: Write the failing test**

Create `lib/capture/providers/airtel-money-uganda.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseAirtelMoneyUgandaMessage } from "./airtel-money-uganda";

describe("parseAirtelMoneyUgandaMessage", () => {
  it("parses a PAID.TID expense", () => {
    const r = parseAirtelMoneyUgandaMessage(
      "PAID.TID 152340835065. UGX 1,000 to Data bundle  Mobile App Charge UGX 0. Bal UGX 37. 23-July-2026 17:09",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(1000);
    expect(r?.feeAmount).toBeUndefined();
    expect(r?.payee).toBe("Data bundle");
  });

  it("parses a cash deposit as income", () => {
    const r = parseAirtelMoneyUgandaMessage(
      "Cash deposit of UGX 10,000 from SARAH. Balance UGX 10,037. Trans ID:152346928830. Date 23-July-2026 18:31.",
    );
    expect(r?.type).toBe("income");
    expect(r?.originalAmount).toBe(10000);
    expect(r?.payee).toBe("SARAH");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/capture/providers/airtel-money-uganda.test.ts`
Expected: FAIL — neither format matched.

- [ ] **Step 3: Add the two formats to `airtel-money-uganda.ts`**

Add `cleanCapturePayee` and `parseCaptureFee` to the import. Insert these two blocks
**before** the existing `incoming` match, and run the existing incoming/outgoing
payees through `cleanCapturePayee`:

```ts
  const deposit = text.match(
    /cash deposit of\s+(UGX|USh)\s*([0-9,]+(?:\.[0-9]+)?)\s+from\s+(.+?)\.\s/i,
  );
  if (deposit) {
    return {
      providerId: "airtel-money-uganda",
      parserLabel: "airtel-deposit",
      type: "income",
      currency: normalizeCurrency(deposit[1]),
      originalAmount: parseAmount(deposit[2]),
      payee: cleanCapturePayee(deposit[3] ?? ""),
      note: text,
      confidenceBoost: 0.35,
    };
  }

  const paid = text.match(
    /PAID\.TID\s+\d+\.\s*(UGX|USh)\s*([0-9,]+(?:\.[0-9]+)?)\s+to\s+(.+?)\s+Mobile App Charge/i,
  );
  if (paid) {
    return {
      providerId: "airtel-money-uganda",
      parserLabel: "airtel-paid",
      type: "expense",
      currency: normalizeCurrency(paid[1]),
      originalAmount: parseAmount(paid[2]),
      payee: cleanCapturePayee(paid[3] ?? ""),
      note: text,
      feeAmount: parseCaptureFee(text),
      confidenceBoost: 0.3,
    };
  }
```

In the existing `incoming` return, change `payee: incoming[3]?.trim(),` to
`payee: cleanCapturePayee(incoming[3] ?? ""),`; in the existing `outgoing` return,
change `payee: outgoing[3]?.trim(),` to `payee: cleanCapturePayee(outgoing[3] ?? ""),`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/capture/providers/airtel-money-uganda.test.ts`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/capture/providers/airtel-money-uganda.ts lib/capture/providers/airtel-money-uganda.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Harden Airtel parser: cash deposit, PAID.TID, bounded payees"
```

---

### Task 4: Absa provider (new) + registration

**Files:**
- Create: `lib/capture/providers/absa-uganda.ts`
- Modify: `lib/capture/providers/index.ts`
- Test: `lib/capture/providers/absa-uganda.test.ts` (create)

**Interfaces:**
- Produces: `parseAbsaUgandaMessage(text: string): CaptureProviderResult | null`.

- [ ] **Step 1: Write the failing test**

Create `lib/capture/providers/absa-uganda.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseAbsaUgandaMessage } from "./absa-uganda";

describe("parseAbsaUgandaMessage", () => {
  it("parses an ATM cash withdrawal", () => {
    const r = parseAbsaUgandaMessage(
      "Absa confirms an ATM cash Withdrawal of UGX 100,000.00 on Acc. ending ***15 on 14/07/2026 at 08:46. Call 0800222333,+256312218348 for enquiries.",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(100000);
    expect(r?.payee).toBe("ATM cash withdrawal");
    expect(r?.occurredOn).toBe("2026-07-14");
  });

  it("returns null for unrelated text", () => {
    expect(parseAbsaUgandaMessage("Received UGX 500 from a friend")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/capture/providers/absa-uganda.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `absa-uganda.ts`**

```ts
import type { CaptureProviderResult } from "@/lib/capture/types";
import { normalizeCurrency, parseAmount, toIsoDate } from "@/lib/capture/providers/shared";

export function parseAbsaUgandaMessage(text: string): CaptureProviderResult | null {
  const match = text.match(
    /Absa confirms an ATM cash Withdrawal of\s+(UGX|USh)\s*([0-9,]+(?:\.[0-9]+)?)\s+on\s+Acc.*?on\s+(\d{2}\/\d{2}\/20\d{2})/i,
  );
  if (!match) {
    return null;
  }

  return {
    providerId: "absa-uganda",
    parserLabel: "absa-atm-withdrawal",
    type: "expense",
    currency: normalizeCurrency(match[1]),
    originalAmount: parseAmount(match[2]),
    payee: "ATM cash withdrawal",
    occurredOn: toIsoDate(match[3]),
    note: text,
    confidenceBoost: 0.35,
  };
}
```

- [ ] **Step 4: Register the provider**

In `lib/capture/providers/index.ts`, add the import and insert into
`providerParsers` **before** `parseBankAlertGeneric`:

```ts
import { parseAbsaUgandaMessage } from "./absa-uganda";
```
```ts
const providerParsers = [
  parseMtnUgandaMessage,
  parseAirtelMoneyUgandaMessage,
  parseAbsaUgandaMessage,
  parseBankAlertGeneric,
] as const;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/capture/providers/absa-uganda.test.ts`
Expected: PASS.

- [ ] **Step 6: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/capture/providers/absa-uganda.ts lib/capture/providers/absa-uganda.test.ts lib/capture/providers/index.ts
git -c commit.gpgsign=false commit --no-verify -m "Add Absa ATM-withdrawal parser"
```

---

### Task 5: Centenary provider (new) + registration

**Files:**
- Create: `lib/capture/providers/centenary-uganda.ts`
- Modify: `lib/capture/providers/index.ts`
- Test: `lib/capture/providers/centenary-uganda.test.ts` (create)

**Interfaces:**
- Consumes: `cleanCapturePayee`, `parseAmount`, `toIsoDate` (Task 1).
- Produces: `parseCentenaryUgandaMessage(text: string): CaptureProviderResult | null`.

- [ ] **Step 1: Write the failing test**

Create `lib/capture/providers/centenary-uganda.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseCentenaryUgandaMessage } from "./centenary-uganda";

describe("parseCentenaryUgandaMessage", () => {
  it("parses a debit (negative) as an expense", () => {
    const r = parseCentenaryUgandaMessage(
      "CENTENARY: Dear HENRY, a trxn of -36,000 on your A/C **767 on 06-07-2026 at 16:11. Bal:5,829 (Funds Transfer (Mobile) /Ebanking). Call 0800200555",
    );
    expect(r?.type).toBe("expense");
    expect(r?.originalAmount).toBe(36000);
    expect(r?.payee).toBe("Funds Transfer (Mobile) /Ebanking");
    expect(r?.occurredOn).toBe("2026-07-06");
  });

  it("parses a credit (positive) as income with a comma-safe amount", () => {
    const r = parseCentenaryUgandaMessage(
      "CENTENARY: Dear HENRY, a trxn of 1,790,590 on your A/C **767 on 24-07-2026 at 13:46. Bal:1,791,819 ( EFT-ORDER MINET UGANDA INSURANCE BROKERS/Head Office). Call",
    );
    expect(r?.type).toBe("income");
    expect(r?.originalAmount).toBe(1790590);
    expect(r?.payee).toBe("EFT-ORDER MINET UGANDA INSURANCE BROKERS/Head Office");
    expect(r?.occurredOn).toBe("2026-07-24");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/capture/providers/centenary-uganda.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `centenary-uganda.ts`**

```ts
import type { CaptureProviderResult } from "@/lib/capture/types";
import { cleanCapturePayee, parseAmount, toIsoDate } from "@/lib/capture/providers/shared";

export function parseCentenaryUgandaMessage(text: string): CaptureProviderResult | null {
  const match = text.match(
    /trxn of\s+(-?)\s*([0-9,]+(?:\.[0-9]+)?).*?on\s+(\d{2}[-/]\d{2}[-/]20\d{2}).*\((.+)\)\.\s*Call/i,
  );
  if (!match) {
    return null;
  }

  const isDebit = match[1] === "-";
  return {
    providerId: "centenary-uganda",
    parserLabel: isDebit ? "centenary-debit" : "centenary-credit",
    type: isDebit ? "expense" : "income",
    currency: "UGX",
    originalAmount: parseAmount(match[2]),
    payee: cleanCapturePayee(match[4] ?? ""),
    occurredOn: toIsoDate(match[3]),
    note: text,
    confidenceBoost: 0.35,
  };
}
```

- [ ] **Step 4: Register the provider**

In `lib/capture/providers/index.ts`, add the import and insert into
`providerParsers` **before** `parseBankAlertGeneric` (after `parseAbsaUgandaMessage`):

```ts
import { parseCentenaryUgandaMessage } from "./centenary-uganda";
```
```ts
const providerParsers = [
  parseMtnUgandaMessage,
  parseAirtelMoneyUgandaMessage,
  parseAbsaUgandaMessage,
  parseCentenaryUgandaMessage,
  parseBankAlertGeneric,
] as const;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/capture/providers/centenary-uganda.test.ts`
Expected: PASS (both debit and credit; amount 1790590 not truncated).

- [ ] **Step 6: Full gate + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add lib/capture/providers/centenary-uganda.ts lib/capture/providers/centenary-uganda.test.ts lib/capture/providers/index.ts
git -c commit.gpgsign=false commit --no-verify -m "Add Centenary signed-transaction parser"
```

---

### Task 6: End-to-end fixture regression + build

**Files:**
- Test: `lib/capture/providers/real-messages.test.ts` (create)

**Interfaces:**
- Consumes: the full pipeline via `parseCaptureText`.

- [ ] **Step 1: Write the fixture test**

Create `lib/capture/providers/real-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseCaptureText } from "@/lib/capture/message-parser";
import type { Category } from "@/lib/types";

const categories: Category[] = [
  { id: "income", userId: "u1", name: "Salary", kind: "income", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "expense", userId: "u1", name: "Groceries", kind: "expense", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "savings", userId: "u1", name: "Savings", kind: "savings", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
];

function parseOne(input: string) {
  return parseCaptureText({ input, source: "sms", accountId: "account:x", categories, existingTransactions: [] })[0];
}

const cases: {
  label: string;
  input: string;
  type?: string;
  amount?: number;
  fee?: number;
  payee?: string;
  date?: string;
}[] = [
  {
    label: "MTN sent (fee 0)",
    input: "You have sent UGX 41410 to MILLY NAKIRANDA, 256785363402 on 2026-06-27 16:56:59, fee: 0. Reason: . New balance: 8953. ID :41669823701.",
    type: "expense", amount: 41410, fee: undefined, payee: "MILLY NAKIRANDA", date: "2026-06-27",
  },
  {
    label: "MTN sent (fee 100)",
    input: "Y'ello. You have sent UGX 5,000 to 256703442862, HENRYSSEKIBO. Fee:UGX 100.00.  Transaction ID:41868059146. Your Mobile Money balance is now UGX 3,853.01.",
    type: "expense", amount: 5000, fee: 100, payee: "256703442862, HENRYSSEKIBO",
  },
  {
    label: "MTN interest",
    input: "You have received UGX 85 from MTN MoMo INTEREST PAYOUT on 2026-07-17 23:23:11. fee:0. Reason: . New balance: UGX 3938.",
    type: "income", amount: 85, fee: undefined, payee: "MTN MoMo INTEREST PAYOUT", date: "2026-07-17",
  },
  {
    label: "MTN received bank",
    input: "You have received UGX 100000 from Centenary Bank . on 2026-06-27 09:25:41. fee:0. Reason: . New balance: UGX 102113.",
    type: "income", amount: 100000, payee: "Centenary Bank", date: "2026-06-27",
  },
  {
    label: "MTN withdrawal",
    input: "You have withdrawn UGX 50,000 on 2026-06-27 09:35:56. Fee: UGX 1,500, Tax: UGX 250. New balance: UGX 50,363.01.",
    type: "expense", amount: 50000, fee: 1750, payee: "Cash withdrawal", date: "2026-06-27",
  },
  {
    label: "Airtel PAID",
    input: "PAID.TID 152340835065. UGX 1,000 to Data bundle  Mobile App Charge UGX 0. Bal UGX 37. 23-July-2026 17:09",
    type: "expense", amount: 1000, fee: undefined, payee: "Data bundle", date: "2026-07-23",
  },
  {
    label: "Airtel deposit",
    input: "Cash deposit of UGX 10,000 from SARAH. Balance UGX 10,037. Trans ID:152346928830. Date 23-July-2026 18:31.",
    type: "income", amount: 10000, payee: "SARAH", date: "2026-07-23",
  },
  {
    label: "Absa ATM",
    input: "Absa confirms an ATM cash Withdrawal of UGX 100,000.00 on Acc. ending ***15 on 14/07/2026 at 08:46. Call 0800222333,+256312218348 for enquiries.",
    type: "expense", amount: 100000, payee: "ATM cash withdrawal", date: "2026-07-14",
  },
  {
    label: "Centenary debit",
    input: "CENTENARY: Dear HENRY, a trxn of -36,000 on your A/C **767 on 06-07-2026 at 16:11. Bal:5,829 (Funds Transfer (Mobile) /Ebanking). Call 0800200555",
    type: "expense", amount: 36000, payee: "Funds Transfer (Mobile) /Ebanking", date: "2026-07-06",
  },
  {
    label: "Centenary credit",
    input: "CENTENARY: Dear HENRY, a trxn of 1,790,590 on your A/C **767 on 24-07-2026 at 13:46. Bal:1,791,819 ( EFT-ORDER MINET UGANDA INSURANCE BROKERS/Head Office). Call",
    type: "income", amount: 1790590, payee: "EFT-ORDER MINET UGANDA INSURANCE BROKERS/Head Office", date: "2026-07-24",
  },
];

describe("real message fixtures", () => {
  for (const c of cases) {
    it(c.label, () => {
      const r = parseOne(c.input);
      if (c.type !== undefined) expect(r.type).toBe(c.type);
      if (c.amount !== undefined) expect(r.originalAmount).toBe(c.amount);
      if ("fee" in c) expect(r.feeAmount).toBe(c.fee);
      if (c.payee !== undefined) expect(r.payee).toBe(c.payee);
      if (c.date !== undefined) expect(r.occurredOn).toBe(c.date);
    });
  }

  it("skips the MTN pre-authorization message (no candidate)", () => {
    const rows = parseCaptureText({
      input:
        "Y'ello. You have requested a withdrawal of UGX 50,000 from ROGERS SSEWAGUDDE . Dial *165# and select My Approvals to authorize the transaction.The total fee is  UGX 1,750 inclusive of 0.5 percent tax.Transaction ID 10173656344",
      source: "sms",
      accountId: "account:x",
      categories,
      existingTransactions: [],
    });
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the fixture test**

Run: `npx vitest run lib/capture/providers/real-messages.test.ts`
Expected: PASS for all fixtures. If any payee/date assertion is off by a formatting
detail, adjust the parser (not the expected value) — the expected values are the
correct real-world interpretation.

- [ ] **Step 3: Full gate + build + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
git add lib/capture/providers/real-messages.test.ts
git -c commit.gpgsign=false commit --no-verify -m "Lock real MTN/Airtel/Absa/Centenary messages as parser fixtures"
```

---

## Self-Review

**Spec coverage:**
- Bounded payee, named-month dates, zero-fee → Task 1 ✓
- MTN pre-auth skip + withdrawal + bounded payees → Task 2 ✓
- Airtel Cash deposit + PAID.TID + bounded payees → Task 3 ✓
- Absa provider + registration → Task 4 ✓
- Centenary signed provider + registration → Task 5 ✓
- 11-message fixture regression → Task 6 ✓

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `cleanCapturePayee(raw): string`, `parseCaptureFee(text): number | undefined`, `toIsoDate(value?): string | undefined`, `parseAmount`, `normalizeCurrency` used consistently. New parsers return `CaptureProviderResult | null` and are registered in `index.ts` before the generic fallback. `parserLabel` values are unique per branch.

**Pre-auth is skipped at two levels:** the MTN provider returns `null` (not an MTN transaction), and the pipeline drops the message via `isNonTransactionalMessage` so the generic fallback can't mint a phantom expense either — Task 6 asserts zero candidates.
