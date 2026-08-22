import { describe, expect, it } from "vitest";

import {
  CORRECTIONS_KEPT,
  getCorrectionsToPrune,
  newestFirst,
} from "@/lib/domain/correction-log-pruning";
import type { CorrectionLog } from "@/lib/types";

function log(day: number): CorrectionLog {
  return {
    id: `correction:${day}`,
    userId: "user:default",
    reviewItemId: `review:${day}`,
    envelopeId: "envelope:1",
    source: "sms",
    confidenceScore: 0.6,
    originalSnapshot: {} as CorrectionLog["originalSnapshot"],
    approvedSnapshot: {} as CorrectionLog["approvedSnapshot"],
    createdAt: `2026-04-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  };
}

describe("getCorrectionsToPrune", () => {
  it("prunes nothing while the list is short", () => {
    expect(getCorrectionsToPrune([log(1), log(2)])).toEqual([]);
  });

  it("drops only what falls past the keep count", () => {
    const logs = Array.from({ length: 8 }, (_, index) => log(index + 1));

    expect(getCorrectionsToPrune(logs, 5).map((entry) => entry.id)).toEqual([
      "correction:3",
      "correction:2",
      "correction:1",
    ]);
  });

  it("keeps the newest, not whatever order the store returned", () => {
    const logs = [log(1), log(9), log(5)];

    expect(newestFirst(logs).map((entry) => entry.id)).toEqual([
      "correction:9",
      "correction:5",
      "correction:1",
    ]);
    expect(getCorrectionsToPrune(logs, 1).map((entry) => entry.id)).toEqual([
      "correction:5",
      "correction:1",
    ]);
  });

  it("keeps enough to be worth looking through", () => {
    expect(CORRECTIONS_KEPT).toBeGreaterThanOrEqual(20);
  });
});
