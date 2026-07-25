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
