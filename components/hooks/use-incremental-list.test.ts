import { describe, expect, it } from "vitest";

import { nextPageCount } from "./use-incremental-list";

describe("nextPageCount", () => {
  it("advances by a page", () => {
    expect(nextPageCount(40, 148, 40)).toBe(80);
  });

  it("stops at the end rather than overshooting", () => {
    expect(nextPageCount(120, 148, 40)).toBe(148);
    expect(nextPageCount(148, 148, 40)).toBe(148);
  });

  it("handles a list shorter than one page", () => {
    expect(nextPageCount(0, 3, 40)).toBe(3);
  });

  it("never goes backwards or below zero", () => {
    expect(nextPageCount(-5, 148, 40)).toBe(40);
  });

  it("always makes progress", () => {
    expect(nextPageCount(10, 148, 0)).toBe(11);
  });
});
