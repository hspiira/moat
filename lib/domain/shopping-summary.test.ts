import { describe, expect, it } from "vitest";

import { shoppingSummaryNotes } from "./shopping-summary";

const basis = "All from prices you set.";

describe("shoppingSummaryNotes", () => {
  it("says what the estimate rests on", () => {
    expect(shoppingSummaryNotes({ basis, boughtCount: 0, boughtAmount: 0 })).toEqual([
      basis,
    ]);
  });

  /* The basis already counts what has no price yet, and the tile that used to
     repeat it sat directly above the sentence saying the same thing. */
  it("leaves the count of unpriced items to the basis", () => {
    expect(
      shoppingSummaryNotes({
        basis: "1 item has no price yet.",
        boughtCount: 0,
        boughtAmount: 0,
      }),
    ).toEqual(["1 item has no price yet."]);
  });

  it("says nothing about buying before anything has been bought", () => {
    expect(
      shoppingSummaryNotes({ basis, boughtCount: 0, boughtAmount: 5000 }).join(" "),
    ).not.toContain("bought");
  });

  /* The headline counts what is still to buy while this counts every trip ever,
     so it has to say so. Unqualified and side by side they read as one shop's
     plan against its outcome, which they are not. */
  it("marks the bought total as running rather than this trip's", () => {
    const notes = shoppingSummaryNotes({ basis, boughtCount: 2, boughtAmount: 1_300_000 });

    expect(notes.join(" ")).toContain("2 bought so far");
    expect(notes.join(" ")).toContain("1,300,000");
  });

  it("keeps the basis first, so the headline is explained before it is qualified", () => {
    expect(
      shoppingSummaryNotes({ basis, boughtCount: 2, boughtAmount: 100 })[0],
    ).toBe(basis);
  });

  it("says nothing at all when there is nothing to say", () => {
    expect(
      shoppingSummaryNotes({ basis: "", boughtCount: 0, boughtAmount: 0 }),
    ).toEqual([]);
  });
});
