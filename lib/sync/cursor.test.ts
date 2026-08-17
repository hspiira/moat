import { describe, expect, it } from "vitest";

import {
  DEFAULT_PULL_PAGE_SIZE,
  MAX_PULL_PAGE_SIZE,
  compareByCursorOrder,
  isAfterCursor,
  parseCursor,
  resolvePageSize,
  serializeCursor,
} from "@/lib/sync/cursor";

describe("parseCursor", () => {
  it("returns null for a missing or blank since", () => {
    expect(parseCursor(undefined)).toBeNull();
    expect(parseCursor("   ")).toBeNull();
  });

  it("reads a bare timestamp as an empty tiebreaker", () => {
    expect(parseCursor("2026-04-06T00:00:00.000Z")).toEqual({
      updatedAt: "2026-04-06T00:00:00.000Z",
      entityKey: "",
    });
  });

  it("round-trips a composite cursor", () => {
    const cursor = { updatedAt: "2026-04-06T00:00:00.000Z", entityKey: "transactions:t1" };
    expect(parseCursor(serializeCursor(cursor))).toEqual(cursor);
  });

  it("keeps separators that appear inside the entity key", () => {
    expect(parseCursor("2026-04-06T00:00:00.000Z|transactions:a|b")).toEqual({
      updatedAt: "2026-04-06T00:00:00.000Z",
      entityKey: "transactions:a|b",
    });
  });
});

describe("compareByCursorOrder", () => {
  it("orders by timestamp first, then entity key", () => {
    const positions = [
      { updatedAt: "2026-04-06T00:00:02.000Z", entityKey: "a" },
      { updatedAt: "2026-04-06T00:00:01.000Z", entityKey: "z" },
      { updatedAt: "2026-04-06T00:00:01.000Z", entityKey: "b" },
    ];

    expect([...positions].sort(compareByCursorOrder).map((entry) => entry.entityKey)).toEqual([
      "b",
      "z",
      "a",
    ]);
  });
});

describe("isAfterCursor", () => {
  const cursor = { updatedAt: "2026-04-06T00:00:01.000Z", entityKey: "m" };

  it("accepts everything when there is no cursor", () => {
    expect(isAfterCursor({ updatedAt: "2020-01-01T00:00:00.000Z", entityKey: "a" }, null)).toBe(true);
  });

  it("breaks ties within the same timestamp by entity key", () => {
    expect(isAfterCursor({ updatedAt: cursor.updatedAt, entityKey: "n" }, cursor)).toBe(true);
    expect(isAfterCursor({ updatedAt: cursor.updatedAt, entityKey: "m" }, cursor)).toBe(false);
    expect(isAfterCursor({ updatedAt: cursor.updatedAt, entityKey: "l" }, cursor)).toBe(false);
  });

  it("includes records stamped exactly at a bare timestamp cursor", () => {
    const bare = parseCursor("2026-04-06T00:00:01.000Z");
    expect(isAfterCursor({ updatedAt: "2026-04-06T00:00:01.000Z", entityKey: "a" }, bare)).toBe(true);
  });
});

describe("resolvePageSize", () => {
  it("defaults when no usable limit is given", () => {
    expect(resolvePageSize(undefined)).toBe(DEFAULT_PULL_PAGE_SIZE);
    expect(resolvePageSize(Number.NaN)).toBe(DEFAULT_PULL_PAGE_SIZE);
  });

  it("clamps to the served range", () => {
    expect(resolvePageSize(0)).toBe(1);
    expect(resolvePageSize(-5)).toBe(1);
    expect(resolvePageSize(10_000)).toBe(MAX_PULL_PAGE_SIZE);
    expect(resolvePageSize(25.7)).toBe(25);
  });
});
