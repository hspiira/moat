import { describe, expect, it } from "vitest";

import { estimateBasis } from "@/components/shopping/estimate-basis";

describe("estimateBasis", () => {
  it("says nothing is planned when there is nothing to price", () => {
    expect(estimateBasis({ total: 0, typed: 0, remembered: 0, unknownCount: 0 })).toBe(
      "Nothing planned yet.",
    );
  });

  it("says how much of the figure came from memory", () => {
    expect(
      estimateBasis({ total: 20_000, typed: 12_000, remembered: 8_000, unknownCount: 0 }),
      // formatMoneyShort joins with a non-breaking space, so match around it.
    ).toMatch(/8,000 of it from what you last paid/);
  });

  it("says how many items still have no price", () => {
    expect(
      estimateBasis({ total: 12_000, typed: 12_000, remembered: 0, unknownCount: 2 }),
    ).toContain("2 items have no price yet");
  });

  it("reads properly for a single item with no price", () => {
    expect(
      estimateBasis({ total: 0, typed: 0, remembered: 0, unknownCount: 1 }),
    ).toContain("1 item has no price yet");
  });

  it("says the figure is all yours when nothing was guessed", () => {
    expect(
      estimateBasis({ total: 12_000, typed: 12_000, remembered: 0, unknownCount: 0 }),
    ).toBe("All from prices you set.");
  });
});
