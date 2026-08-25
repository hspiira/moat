"use client";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  buildShortcutSteps,
  buildShortcutUrlTemplate,
  buildTestCaptureUrl,
} from "@/lib/capture/shortcut-recipe";
import { enqueueNativeCapturePayload } from "@/lib/native/capture-bridge";
import { parseNativeCaptureUrl } from "@/lib/native/capture-deep-link";
import {
  addCaptureShortcutSender,
  canAddCaptureShortcutSender,
  defaultCaptureShortcutPreferences,
  readCaptureShortcutPreferences,
  removeCaptureShortcutSender,
  saveCaptureShortcutPreferences,
  type CaptureShortcutPreferences,
} from "@/lib/preferences/capture-shortcut";

export function CaptureShortcutPanel() {
  const { show } = useToast();
  const [preferences, setPreferences] = useState<CaptureShortcutPreferences>(() =>
    typeof window === "undefined"
      ? defaultCaptureShortcutPreferences
      : readCaptureShortcutPreferences(),
  );
  const [draft, setDraft] = useState("");

  const template = buildShortcutUrlTemplate(preferences.senders[0]);
  const steps = buildShortcutSteps(preferences.senders);

  function update(next: CaptureShortcutPreferences) {
    setPreferences(next);
    saveCaptureShortcutPreferences(next);
  }

  function addSender() {
    const next = addCaptureShortcutSender(preferences, draft);
    if (next === preferences) {
      show(
        canAddCaptureShortcutSender(preferences)
          ? "That sender is already on the list."
          : "That is as many senders as Moat keeps.",
        "error",
      );
      return;
    }
    update(next);
    setDraft("");
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template);
      show("Copied. Paste it into the Shortcuts Text action.");
    } catch {
      // A web view can refuse the clipboard, and the line is on screen to read.
      show("Couldn't copy. Select the line below and copy it by hand.", "error");
    }
  }

  // Sent through the same parser the shortcut reaches, so a run that lands in
  // review proves the whole path rather than only that the button works.
  function sendTestCapture() {
    const payload = parseNativeCaptureUrl(buildTestCaptureUrl(preferences.senders[0]));
    if (!payload) {
      show("Couldn't build a test capture.", "error");
      return;
    }

    enqueueNativeCapturePayload(payload);
    show("Test message sent. Look for it in capture review.");
  }

  return (
    <Card className="shadow-none">
      <CardContent className="grid gap-5 p-5">
        <div className="grid gap-1">
          <div className="text-sm text-foreground">Capture money messages with a Shortcut</div>
          <div className="text-sm text-muted-foreground">
            iOS does not let an app read your messages, so a Shortcut you own hands them over
            instead. Add the senders you want captured and Moat writes the rest of the recipe.
            Everything captured goes to review; nothing posts to your ledger without your say-so.
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-xs text-muted-foreground">Senders you want captured</div>
          {preferences.senders.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {preferences.senders.map((sender) => (
                <span
                  key={sender}
                  className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                >
                  {sender}
                  <button
                    type="button"
                    aria-label={`Remove ${sender}`}
                    onClick={() => update(removeCaptureShortcutSender(preferences, sender))}
                    className="text-muted-foreground"
                  >
                    <IconX className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              None yet. Add the name your bank or wallet messages arrive under.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSender();
                }
              }}
              placeholder="MTN MoMo"
              aria-label="Sender name"
              className="h-9 max-w-48"
            />
            <Button type="button" size="sm" variant="outline" onClick={addSender}>
              Add sender
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-xs text-muted-foreground">Your Shortcut recipe</div>
          <ol className="grid list-decimal gap-1 pl-5 text-xs text-muted-foreground">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <code className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
            {template}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyTemplate()}>
              Copy the line
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={sendTestCapture}>
              Send a test capture
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
