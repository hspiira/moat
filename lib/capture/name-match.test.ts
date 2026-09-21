import { describe, expect, it } from "vitest";

import { matchByName } from "./name-match";

const accounts = [
  { id: "account:momo", names: ["MTN MoMo"] },
  { id: "account:airtel", names: ["Airtel Money"] },
  { id: "account:bank", names: ["Centenary Bank", "Centenary"] },
];

describe("matchByName", () => {
  it("matches a name written the same way", () => {
    expect(matchByName(accounts, ["MTN MoMo"])?.id).toBe("account:momo");
  });

  /* Senders arrive squashed and punctuated however the provider felt: the same
     account is MTN MoMo, MTNMoMo and mtn-momo. */
  it("looks past spacing, case and punctuation", () => {
    for (const written of ["MTNMoMo", "mtn momo", "MTN-MOMO", " mtn.momo "]) {
      expect(matchByName(accounts, [written])?.id, written).toBe("account:momo");
    }
  });

  /* A sender is written shorter than the account it belongs to as often as
     longer, so containment has to count both ways. */
  it("matches a name shorter than what it was found in", () => {
    expect(matchByName(accounts, ["CentenaryBank"])?.id).toBe("account:bank");
  });

  it("matches a name longer than what it was found in", () => {
    expect(matchByName(accounts, ["Centenary"])?.id).toBe("account:bank");
  });

  it("finds a name inside a whole message", () => {
    expect(
      matchByName(accounts, [undefined, "Confirmed. You have sent UGX 1,000 on Airtel Money."])?.id,
    ).toBe("account:airtel");
  });

  it("prefers the earlier haystack, so a sender outranks the message body", () => {
    expect(
      matchByName(accounts, ["Airtel Money", "paid from MTN MoMo"])?.id,
    ).toBe("account:airtel");
  });

  /* A longer name is the more specific one, and would otherwise lose to a
     shorter name that happens to sit inside the same text. */
  it("prefers the longer name when both would match", () => {
    const entries = [
      { id: "account:general", names: ["Bank"] },
      { id: "account:specific", names: ["Centenary Bank"] },
    ];

    expect(matchByName(entries, ["Centenary Bank"])?.id).toBe("account:specific");
  });

  it("matches nothing rather than guessing", () => {
    expect(matchByName(accounts, ["Stanbic"])).toBeUndefined();
    expect(matchByName(accounts, ["Paid UGX 5,000 to Grocery"])).toBeUndefined();
  });

  it("matches nothing when there is nothing to go on", () => {
    expect(matchByName(accounts, [])).toBeUndefined();
    expect(matchByName(accounts, [undefined, "", "   "])).toBeUndefined();
    expect(matchByName([], ["MTN MoMo"])).toBeUndefined();
  });

  /* A two letter name sits inside almost any message, so matching on it would
     attach money to an account for no reason at all. */
  it("ignores a name too short to mean anything", () => {
    expect(matchByName([{ id: "account:x", names: ["AB"] }], ["Paid ABC to someone"]))
      .toBeUndefined();
  });

  it("ignores a name that is only punctuation", () => {
    expect(matchByName([{ id: "account:x", names: ["--"] }], ["anything"])).toBeUndefined();
  });
});
