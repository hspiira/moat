import { describe, expect, it } from "vitest";

import { countAnotherOccurrence, occurrenceCountOf } from "./occurrences";
import type { CaptureReviewItem } from "@/lib/types";

function item(overrides: Partial<CaptureReviewItem> = {}): CaptureReviewItem {
  return {
    id: "capture-review:1",
    createdAt: "2026-04-07T10:00:00.000Z",
    updatedAt: "2026-04-07T10:00:00.000Z",
    ...overrides,
  } as CaptureReviewItem;
}

describe("occurrenceCountOf", () => {
  it("counts a row nobody has repeated as one", () => {
    expect(occurrenceCountOf(item())).toBe(1);
  });

  it("reads the count when there is one", () => {
    expect(occurrenceCountOf(item({ occurrenceCount: 4 }))).toBe(4);
  });

  /* A row that arrived once is one occurrence, whatever a stored zero or a
     negative claims, so a badge can never say "0 times". */
  it("never counts fewer than one", () => {
    expect(occurrenceCountOf(item({ occurrenceCount: 0 }))).toBe(1);
    expect(occurrenceCountOf(item({ occurrenceCount: -3 }))).toBe(1);
  });
});

describe("countAnotherOccurrence", () => {
  it("counts the second arrival and remembers both moments", () => {
    const counted = countAnotherOccurrence(item(), "2026-04-07T11:00:00.000Z");

    expect(counted.occurrenceCount).toBe(2);
    expect(counted.occurrenceCapturedAt).toEqual([
      "2026-04-07T10:00:00.000Z",
      "2026-04-07T11:00:00.000Z",
    ]);
  });

  it("keeps counting past the second", () => {
    let counted = item();
    for (let index = 0; index < 4; index += 1) {
      counted = countAnotherOccurrence(counted, `2026-04-07T1${index}:00:00.000Z`);
    }

    expect(counted.occurrenceCount).toBe(5);
    expect(counted.occurrenceCapturedAt).toHaveLength(5);
  });

  it("moves the row's updated time to the latest arrival", () => {
    expect(countAnotherOccurrence(item(), "2026-04-07T11:00:00.000Z").updatedAt).toBe(
      "2026-04-07T11:00:00.000Z",
    );
  });

  it("leaves everything else on the row alone", () => {
    const before = item({ status: "new", payee: "Grocery" });
    const counted = countAnotherOccurrence(before, "2026-04-07T11:00:00.000Z");

    expect(counted.id).toBe(before.id);
    expect(counted.status).toBe("new");
    expect(counted.payee).toBe("Grocery");
    expect(counted.createdAt).toBe(before.createdAt);
  });

  /* An automation firing in a loop must not grow one row without end. The count
     still rises; only the remembered moments are trimmed, oldest first. */
  it("stops remembering moments long before it stops counting", () => {
    let counted = item();
    for (let index = 0; index < 80; index += 1) {
      counted = countAnotherOccurrence(counted, `2026-04-07T10:00:${String(index % 60).padStart(2, "0")}.000Z`);
    }

    expect(counted.occurrenceCount).toBe(81);
    expect(counted.occurrenceCapturedAt).toHaveLength(50);
  });

  it("does not change the row it was given", () => {
    const before = item();
    countAnotherOccurrence(before, "2026-04-07T11:00:00.000Z");

    expect(before.occurrenceCount).toBeUndefined();
  });
});
