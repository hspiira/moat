import { describe, expect, it } from "vitest";

import {
  SHORTCUT_TEST_MESSAGE,
  SHORTCUT_TEXT_TOKEN,
  buildCaptureUrl,
  buildIntentSteps,
  buildShortcutSteps,
  buildShortcutUrlTemplate,
  buildTestCaptureUrl,
} from "./shortcut-recipe";
import { parseNativeCaptureUrl } from "@/lib/native/capture-deep-link";

describe("buildCaptureUrl", () => {
  it("builds a url the app's own parser accepts", () => {
    expect(parseNativeCaptureUrl(buildCaptureUrl({ text: "Sent UGX 5,000" }))).toMatchObject({
      rawContent: "Sent UGX 5,000",
    });
  });

  it("carries the sender and the moment through the parser", () => {
    const url = buildCaptureUrl({
      text: "Sent UGX 5,000",
      sender: "MTN MoMo",
      occurredAt: "2026-04-07T10:00:00.000Z",
    });

    expect(parseNativeCaptureUrl(url)).toMatchObject({
      rawContent: "Sent UGX 5,000",
      sourceTitle: "MTN MoMo",
      occurredAt: "2026-04-07T10:00:00.000Z",
    });
  });

  /* A money message is mostly punctuation, and an unescaped ampersand would cut
     the message short at the parser without anything reporting it. */
  it("survives the punctuation a money message is full of", () => {
    const awkward = "Paid UGX 5,000 & 50% fee to A&B Ltd? ref=#12/34 +256";

    expect(parseNativeCaptureUrl(buildCaptureUrl({ text: awkward }))?.rawContent).toBe(awkward);
  });

  it("leaves out a sender that is only spaces", () => {
    expect(
      parseNativeCaptureUrl(buildCaptureUrl({ text: "Sent UGX 5,000", sender: "   " }))
        ?.sourceTitle,
    ).toBeUndefined();
  });
});

describe("buildShortcutUrlTemplate", () => {
  /* The token is the one part Shortcuts fills in, so it has to survive into the
     pasted line exactly as the action is named there. */
  it("leaves the message token to be replaced in Shortcuts", () => {
    expect(buildShortcutUrlTemplate()).toBe(`moat://capture?text=${SHORTCUT_TEXT_TOKEN}`);
  });

  it("encodes a sender the app already knows", () => {
    expect(buildShortcutUrlTemplate("MTN MoMo")).toBe(
      `moat://capture?text=${SHORTCUT_TEXT_TOKEN}&sender=MTN%20MoMo`,
    );
  });

  it("leaves out a sender that is only spaces", () => {
    expect(buildShortcutUrlTemplate("  ")).toBe(`moat://capture?text=${SHORTCUT_TEXT_TOKEN}`);
  });

  it("becomes a url the parser accepts once the token is filled in", () => {
    const filled = buildShortcutUrlTemplate("MTN MoMo").replace(
      SHORTCUT_TEXT_TOKEN,
      encodeURIComponent("Sent UGX 5,000"),
    );

    expect(parseNativeCaptureUrl(filled)).toMatchObject({
      rawContent: "Sent UGX 5,000",
      sourceTitle: "MTN MoMo",
    });
  });
});

describe("buildShortcutSteps", () => {
  it("names the senders that were configured", () => {
    expect(buildShortcutSteps(["MTN MoMo", "Stanbic"]).join(" ")).toContain("MTN MoMo, Stanbic");
  });

  it("still reads as instructions before any sender is added", () => {
    const steps = buildShortcutSteps([]);

    expect(steps).toHaveLength(6);
    expect(steps.join(" ")).toContain("the bank or wallet you want captured");
  });

  it("ignores a blank sender rather than naming nothing", () => {
    expect(buildShortcutSteps(["  ", "Stanbic"]).join(" ")).toContain('"Sender" to Stanbic');
  });
});

describe("buildTestCaptureUrl", () => {
  it("makes a test the parser reads as a real capture", () => {
    expect(parseNativeCaptureUrl(buildTestCaptureUrl("MTN MoMo"))).toMatchObject({
      rawContent: SHORTCUT_TEST_MESSAGE,
      sourceTitle: "MTN MoMo",
      channel: "shared_text",
    });
  });

  it("says it is a test when no sender was configured", () => {
    expect(parseNativeCaptureUrl(buildTestCaptureUrl())?.sourceTitle).toBe("Moat test");
  });
});

describe("buildIntentSteps", () => {
  /* The shorter recipe for a phone that has the action. No url is built, so
     there is no line to paste and nothing to url-encode. */
  it("names the senders and never mentions a url", () => {
    const steps = buildIntentSteps(["MTN MoMo", "Stanbic"]);

    expect(steps.join(" ")).toContain("MTN MoMo, Stanbic");
    expect(steps.join(" ")).toContain("Capture money message");
    expect(steps.join(" ")).not.toContain("moat://");
  });

  it("is shorter than the url recipe it replaces", () => {
    expect(buildIntentSteps([]).length).toBeLessThan(buildShortcutSteps([]).length);
  });

  it("still reads as instructions before any sender is added", () => {
    expect(buildIntentSteps([]).join(" ")).toContain("the bank or wallet you want captured");
  });
});
