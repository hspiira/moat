import { describe, expect, it } from "vitest";

import {
  joinMessages,
  partitionMessagesBySender,
  type SenderMatcher,
} from "@/lib/capture/sender-filter";

const matchers: SenderMatcher[] = [
  { id: "mtn-momo", matchTerms: ["MTN Mobile Money", "MTNMoMo"] },
  { id: "stanbic", matchTerms: ["Stanbic"] },
];

const momo = "MTN Mobile Money: You have received UGX 500,000 from Employer Ltd.";
const stanbic = "Stanbic Bank: Your account was debited USh 45,000 at Grocery store.";
const unknown = "Your parcel from Posta Uganda is ready for collection.";

describe("partitionMessagesBySender", () => {
  it("marks a message from a sender the person enabled", () => {
    const result = partitionMessagesBySender(momo, matchers);

    expect(result.matched).toEqual([{ senderId: "mtn-momo", message: momo }]);
    expect(result.unmatched).toEqual([]);
  });

  it("separates a message from a sender nobody enabled", () => {
    const result = partitionMessagesBySender(unknown, matchers);

    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([unknown]);
  });

  it("keeps an unmatched message rather than discarding it", () => {
    // Dropping it would hide real money. The caller decides what to do.
    const result = partitionMessagesBySender(`${momo}\n\n${unknown}`, matchers);

    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toEqual([unknown]);
  });

  it("splits a batch and sorts each message on its own", () => {
    const result = partitionMessagesBySender(
      `${momo}\n\n${stanbic}\n\n${unknown}`,
      matchers,
    );

    expect(result.matched.map((entry) => entry.senderId)).toEqual(["mtn-momo", "stanbic"]);
    expect(result.unmatched).toEqual([unknown]);
  });

  it("ignores letter case, because sender text varies between messages", () => {
    const result = partitionMessagesBySender("mtnmomo: you have received UGX 10,000", matchers);

    expect(result.matched.map((entry) => entry.senderId)).toEqual(["mtn-momo"]);
  });

  it("matches on any one of a sender's terms", () => {
    const result = partitionMessagesBySender("MTNMoMo received UGX 10,000", matchers);

    expect(result.matched.map((entry) => entry.senderId)).toEqual(["mtn-momo"]);
  });

  it("treats every message as unmatched when no sender is enabled", () => {
    const result = partitionMessagesBySender(`${momo}\n\n${stanbic}`, []);

    expect(result.matched).toEqual([]);
    expect(result.unmatched).toHaveLength(2);
  });

  it("returns nothing for empty input", () => {
    expect(partitionMessagesBySender("   ", matchers)).toEqual({ matched: [], unmatched: [] });
  });

  it("assigns a message to the first matching sender only", () => {
    const overlapping: SenderMatcher[] = [
      { id: "first", matchTerms: ["bank"] },
      { id: "second", matchTerms: ["Stanbic"] },
    ];

    const result = partitionMessagesBySender(stanbic, overlapping);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].senderId).toBe("first");
  });
});

describe("joinMessages", () => {
  it("rejoins messages so the parser reads them as a batch", () => {
    expect(joinMessages([momo, stanbic])).toBe(`${momo}\n\n${stanbic}`);
  });

  it("returns an empty string for nothing", () => {
    expect(joinMessages([])).toBe("");
  });
});
