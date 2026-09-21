import { describe, expect, it } from "vitest";

import {
  canCreatePickOption,
  collectPickOptions,
  matchPickOptions,
  pickMatchKey,
} from "./pick-options";

describe("pickMatchKey", () => {
  it("reads one name written differently as the same name", () => {
    expect(pickMatchKey("  MTN  MoMo ")).toBe(pickMatchKey("mtn momo"));
  });
});

describe("matchPickOptions", () => {
  const options = ["Umeme", "NWSC", "MTN MoMo"];

  it("offers everything before anything is typed", () => {
    expect(matchPickOptions(options, "")).toEqual(options);
    expect(matchPickOptions(options, "   ")).toEqual(options);
  });

  it("matches on part of a name, whatever the case", () => {
    expect(matchPickOptions(options, "ume")).toEqual(["Umeme"]);
    expect(matchPickOptions(options, "MOMO")).toEqual(["MTN MoMo"]);
  });

  it("matches nothing rather than everything when nothing fits", () => {
    expect(matchPickOptions(options, "Stanbic")).toEqual([]);
  });
});

describe("canCreatePickOption", () => {
  const options = ["Umeme", "NWSC"];

  it("offers a name that is genuinely new", () => {
    expect(canCreatePickOption(options, "Stanbic")).toBe(true);
  });

  /* Offering one that exists is how a list grows two spellings of one payee,
     and the two then never group together anywhere. */
  it("does not offer a name already there under another spelling", () => {
    expect(canCreatePickOption(options, "umeme")).toBe(false);
    expect(canCreatePickOption(options, "  UMEME  ")).toBe(false);
  });

  it("offers nothing when nothing was typed", () => {
    expect(canCreatePickOption(options, "")).toBe(false);
    expect(canCreatePickOption(options, "   ")).toBe(false);
  });
});

describe("collectPickOptions", () => {
  it("puts what is used most within reach first", () => {
    expect(collectPickOptions(["Umeme", "NWSC", "Umeme", "Umeme", "NWSC"])).toEqual([
      "Umeme",
      "NWSC",
    ]);
  });

  it("settles ties alphabetically, so the order never wanders", () => {
    expect(collectPickOptions(["Zain", "Absa"])).toEqual(["Absa", "Zain"]);
  });

  it("counts one name written differently as one name, keeping the first spelling", () => {
    expect(collectPickOptions(["MTN MoMo", "mtn momo", "  MTN  MOMO "])).toEqual(["MTN MoMo"]);
  });

  it("passes over what was never filled in", () => {
    expect(collectPickOptions([undefined, null, "", "   ", "Umeme"])).toEqual(["Umeme"]);
  });

  it("has nothing to offer from nothing", () => {
    expect(collectPickOptions([])).toEqual([]);
  });
});
