/**
 * The recipe a person follows in the Shortcuts app, worked out here rather than
 * written into the panel, so what is shown and what the parser accepts cannot
 * drift apart.
 */

// Left unencoded on purpose: this is the one part the person replaces with the
// Shortcuts variable of the same name, so it has to read as that name.
export const SHORTCUT_TEXT_TOKEN = "[URL Encoded Shortcut Input]";

const CAPTURE_URL = "moat://capture";

export function buildCaptureUrl(params: { text: string; sender?: string; occurredAt?: string }) {
  const query = new URLSearchParams({ text: params.text });
  if (params.sender?.trim()) query.set("sender", params.sender.trim());
  if (params.occurredAt?.trim()) query.set("occurredAt", params.occurredAt.trim());
  return `${CAPTURE_URL}?${query}`;
}

/**
 * The line the person pastes into the Shortcuts Text action. The message token
 * stays as written while the sender is encoded, because the sender is a value
 * this app already knows and the message is one only Shortcuts can fill in.
 */
export function buildShortcutUrlTemplate(sender?: string): string {
  const senderName = sender?.trim();
  const suffix = senderName ? `&sender=${encodeURIComponent(senderName)}` : "";
  return `${CAPTURE_URL}?text=${SHORTCUT_TEXT_TOKEN}${suffix}`;
}

export function buildShortcutSteps(senders: string[]): string[] {
  const named = senders.filter((sender) => sender.trim());
  const senderStep = named.length
    ? `Set "Sender" to ${named.join(", ")}.`
    : 'Set "Sender" to the bank or wallet you want captured.';

  return [
    'In Shortcuts, open Automation and add a new "Message" automation.',
    senderStep,
    "Choose Run Immediately if your iPhone offers it, so nothing has to be confirmed.",
    'Add a "URL Encode" action and pass it the message content.',
    'Add a "Text" action holding the line below, with the encoded message in place of the token.',
    'Finish with "Open URLs" on that text.',
  ];
}

/* A message that reads as a test wherever it lands, so a run that reaches the
   inbox is recognisable there and a parse that mangles it is obvious. */
export const SHORTCUT_TEST_MESSAGE = "Confirmed. You have sent UGX 1,000 to MOAT TEST.";

export function buildTestCaptureUrl(sender?: string): string {
  return buildCaptureUrl({
    text: SHORTCUT_TEST_MESSAGE,
    sender: sender?.trim() || "Moat test",
  });
}
