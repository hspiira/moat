/**
 * Reading a money message the person already copied.
 *
 * An iOS Shortcut can watch for a message from a bank or a mobile money sender
 * and copy it to the clipboard. Reading it here turns that into one tap instead
 * of a retype. iOS shows its own "Paste" confirmation, so the app never reads
 * the clipboard without the person seeing it.
 */

export type ClipboardReadResult =
  | { status: "read"; text: string }
  | { status: "empty" }
  | { status: "denied" }
  | { status: "unsupported" };

export async function readClipboardText(): Promise<ClipboardReadResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
    return { status: "unsupported" };
  }

  try {
    const text = await navigator.clipboard.readText();
    return text.trim() ? { status: "read", text } : { status: "empty" };
  } catch {
    // Refusing the iOS paste prompt lands here, and so does a browser that
    // blocks clipboard reads outright. Both mean the same thing to the caller.
    return { status: "denied" };
  }
}
