import { describe, expect, it } from "vitest";

import { parseCaptureEnvelope } from "@/lib/capture/pipeline";
import { createNotificationEnvelope } from "@/lib/capture/source-adapters/notification";
import type { Category, Transaction } from "@/lib/types";

const categories: Category[] = [
  { id: "income", userId: "u1", name: "Salary", kind: "income", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "expense", userId: "u1", name: "Groceries", kind: "expense", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "savings", userId: "u1", name: "Savings", kind: "savings", isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" },
];

describe("parseCaptureEnvelope", () => {
  it("uses provider packs for notification payloads", () => {
    const envelope = createNotificationEnvelope({
      userId: "u1",
      rawContent: "Received UGX 500000 from Employer Ltd on 27-03-2026",
      sourceApp: "com.mtn.uganda.momo",
    });

    const rows = parseCaptureEnvelope({
      envelope,
      source: "notification",
      accountId: "account:bank",
      categories,
      existingTransactions: [] as Transaction[],
    });

    expect(rows[0]).toMatchObject({
      providerId: "mtn-uganda",
      parserLabel: "mtn-incoming",
      type: "income",
      occurredOn: "2026-03-27",
    });
  });

  it("adds field warnings for foreign currency rows without FX", () => {
    const envelope = createNotificationEnvelope({
      userId: "u1",
      rawContent: "Paid USD 25 to Streaming service on 06-04-2026",
      sourceApp: "com.airtel.ug",
    });

    const rows = parseCaptureEnvelope({
      envelope,
      source: "notification",
      accountId: "account:bank",
      categories,
      existingTransactions: [] as Transaction[],
    });

    expect(rows[0]?.fieldWarnings.some((warning) => warning.field === "currency")).toBe(true);
    expect(rows[0]?.issues).toContain("FX rate is required to convert this amount to UGX.");
  });
});
