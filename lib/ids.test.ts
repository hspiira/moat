import { describe, expect, it } from "vitest";

import { createId, deriveSeededId, isValidId } from "@/lib/ids";

describe("createId", () => {
  it("produces a valid cuid2", () => {
    expect(isValidId(createId())).toBe(true);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 5000 }, createId));
    expect(ids.size).toBe(5000);
  });

  it("carries no type prefix", () => {
    expect(createId()).not.toContain(":");
  });
});

describe("deriveSeededId", () => {
  it("gives the same id for the same user and slug", () => {
    expect(deriveSeededId("user-1", "category:fees-charges")).toBe(
      deriveSeededId("user-1", "category:fees-charges"),
    );
  });

  it("gives different ids to different users", () => {
    expect(deriveSeededId("user-1", "category:fees-charges")).not.toBe(
      deriveSeededId("user-2", "category:fees-charges"),
    );
  });

  it("gives different ids to different slugs", () => {
    expect(deriveSeededId("user-1", "category:fees-charges")).not.toBe(
      deriveSeededId("user-1", "category:loan-interest"),
    );
  });

  it("cannot be confused by moving the boundary between user and slug", () => {
    expect(deriveSeededId("ab", "c")).not.toBe(deriveSeededId("a", "bc"));
  });

  it("looks like a cuid2", () => {
    const id = deriveSeededId("user-1", "account:money-lent-out");
    expect(id).toHaveLength(24);
    expect(id).toMatch(/^[a-z][a-z0-9]{23}$/);
    expect(isValidId(id)).toBe(true);
  });

  it("spreads slugs across distinct ids", () => {
    const slugs = Array.from({ length: 500 }, (_, index) => `category:seed-${index}`);
    const ids = new Set(slugs.map((slug) => deriveSeededId("user-1", slug)));
    expect(ids.size).toBe(500);
  });

  it("matches its recorded output", () => {
    expect(deriveSeededId("user:default", "category:fees-charges")).toBe(
      "sc4jmmofomt72fxgmmza7w4z",
    );
    expect(deriveSeededId("user:default", "account:money-lent-out")).toBe(
      "rzjsthnipca70iepfwk5fv4m",
    );
    expect(deriveSeededId("abc", "x")).toBe("lwbot2e9xvludaisbkd4na1o");
  });
});
