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
  /* The Sender field takes a sender id, so that is what to set. Whether a
     trigger on one fires cannot be known without being sent a message, so the
     message-content match is offered for when nothing arrives. */
  it("sets the sender, and offers the message match as the fallback", () => {
    const steps = buildShortcutSteps(["MTNMobMoney"]).join(" ");

    expect(steps).toContain("Set Sender to MTNMobMoney");
    expect(steps).toContain("If nothing arrives");
    expect(steps).toContain("Message Contains");
  });

  it("says a sender id is not a contact, since that is what it looks like", () => {
    expect(buildShortcutSteps([]).join(" ")).toContain("rather than a contact");
  });

  it("still reads as instructions before any sender is added", () => {
    expect(buildShortcutSteps([]).length).toBeGreaterThan(3);
  });

  it("ignores a blank sender rather than naming nothing", () => {
    expect(buildShortcutSteps(["  ", "Stanbic"]).join(" ")).toContain("Stanbic");
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
  it("uses the action and never mentions a url", () => {
    const steps = buildIntentSteps(["MTNMobMoney"]).join(" ");

    expect(steps).toContain("Capture money message");
    expect(steps).not.toContain("moat://");
  });

  /* The name is typed in rather than read off the message, because the app
     matches it against the account chosen for that sender and iOS may not hand
     a provider id over at all. */
  it("has the sender typed in rather than taken from the message", () => {
    const steps = buildIntentSteps(["MTNMobMoney"]).join(" ");

    expect(steps).toContain("Type MTNMobMoney into Sender");
    expect(steps).toContain("rather than taking it from the message");
  });

  /* One automation cannot hand over three different names, so each provider
     needs its own, and the account each one lands on depends on it. */
  it("asks for one automation per provider when there is more than one", () => {
    expect(buildIntentSteps(["MTNMobMoney", "AirtelMoney"]).join(" ")).toContain(
      "once for each of MTNMobMoney, AirtelMoney",
    );
  });

  it("says nothing about repeating when there is only one", () => {
    expect(buildIntentSteps(["MTNMobMoney"]).join(" ")).not.toContain("Repeat this");
  });

  it("still reads as instructions before any sender is added", () => {
    expect(buildIntentSteps([]).join(" ")).toContain("the provider");
  });
});
