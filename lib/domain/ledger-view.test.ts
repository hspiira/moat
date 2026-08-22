import { describe, expect, it } from "vitest";

import {
  filterByWindow,
  parseLedgerSort,
  parseLedgerWindow,
  sortForLedger,
  windowStartsOn,
} from "@/lib/domain/ledger-view";
import type { Transaction } from "@/lib/types";

function entry(id: string, day: string, amount: number, type: Transaction["type"] = "expense"): Transaction {
  return {
    id,
    userId: "user:default",
    accountId: "account:cash",
    type,
    amount,
    currency: "UGX",
    originalAmount: Math.abs(amount),
    occurredOn: day,
    categoryId: "category:food",
    reconciliationState: "posted",
    source: "manual",
    createdAt: `${day}T08:00:00.000Z`,
    updatedAt: `${day}T08:00:00.000Z`,
  };
}

describe("parseLedgerWindow", () => {
  it("takes only the windows the page offers", () => {
    expect(parseLedgerWindow("30")).toBe(30);
    expect(parseLedgerWindow("31")).toBeNull();
    expect(parseLedgerWindow(null)).toBeNull();
    expect(parseLedgerWindow("everything")).toBeNull();
  });
});

describe("parseLedgerSort", () => {
  it("only accepts largest, and defaults to recent", () => {
    expect(parseLedgerSort("largest")).toBe("largest");
    expect(parseLedgerSort("oldest")).toBe("recent");
    expect(parseLedgerSort(null)).toBe("recent");
  });
});

describe("windowStartsOn", () => {
  it("counts today as one of the days", () => {
    expect(windowStartsOn(7, "2026-08-17")).toBe("2026-08-11");
    expect(windowStartsOn(1, "2026-08-17")).toBe("2026-08-17");
  });

  it("crosses a month end", () => {
    expect(windowStartsOn(7, "2026-03-03")).toBe("2026-02-25");
  });
});

describe("filterByWindow", () => {
  const rows = [
    entry("today", "2026-08-17", 1_000),
    entry("inside", "2026-08-12", 2_000),
    entry("outside", "2026-08-01", 3_000),
  ];

  it("keeps only what falls inside the window", () => {
    expect(filterByWindow(rows, 7, "2026-08-17").map((row) => row.id)).toEqual([
      "today",
      "inside",
    ]);
  });

  it("keeps everything when no window is chosen", () => {
    expect(filterByWindow(rows, null, "2026-08-17")).toHaveLength(3);
  });

  it("counts back from today, not from the newest entry", () => {
    expect(filterByWindow(rows, 7, "2026-08-31")).toEqual([]);
  });
});

describe("sortForLedger", () => {
  it("leaves the order alone for recent", () => {
    const rows = [entry("a", "2026-08-01", 1_000), entry("b", "2026-08-02", 9_000)];
    expect(sortForLedger(rows, "recent").map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("puts the biggest money out first", () => {
    const rows = [
      entry("small", "2026-08-01", 1_000),
      entry("big", "2026-08-02", 9_000),
      entry("middle", "2026-08-03", 5_000),
    ];
    expect(sortForLedger(rows, "largest").map((row) => row.id)).toEqual([
      "big",
      "middle",
      "small",
    ]);
  });

  it("does not let a large payment in outrank the spending", () => {
    const rows = [
      entry("spent", "2026-08-01", 5_000),
      entry("received", "2026-08-02", 900_000, "income"),
    ];
    expect(sortForLedger(rows, "largest")[0].id).toBe("spent");
  });
});

describe("what counts as money gone", () => {
  it("does not rank a transfer between your own accounts as spending", () => {
    const rows = [
      entry("spent", "2026-08-01", 4_000),
      entry("moved", "2026-08-02", 900_000, "transfer"),
    ];

    expect(sortForLedger(rows, "largest")[0].id).toBe("spent");
  });
});
