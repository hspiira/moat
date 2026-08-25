"use client";

const CAPTURE_SHORTCUT_PREFERENCES_KEY = "moat.capture-shortcut";

// Enough for every bank and wallet someone actually hears from, and low enough
// that a runaway write cannot fill the store the ledger shares.
const MAX_SENDERS = 20;

export type CaptureShortcutPreferences = {
  /** Names as they appear on the message, in the order they were added. */
  senders: string[];
};

export const defaultCaptureShortcutPreferences: CaptureShortcutPreferences = { senders: [] };

export function readCaptureShortcutPreferences(): CaptureShortcutPreferences {
  if (typeof window === "undefined") return defaultCaptureShortcutPreferences;

  try {
    const raw = window.localStorage.getItem(CAPTURE_SHORTCUT_PREFERENCES_KEY);
    if (!raw) return defaultCaptureShortcutPreferences;

    const parsed = JSON.parse(raw) as Partial<CaptureShortcutPreferences>;
    const senders = Array.isArray(parsed.senders)
      ? parsed.senders.filter((entry): entry is string => typeof entry === "string")
      : [];

    return { senders: senders.slice(0, MAX_SENDERS) };
  } catch {
    return defaultCaptureShortcutPreferences;
  }
}

export function saveCaptureShortcutPreferences(preferences: CaptureShortcutPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CAPTURE_SHORTCUT_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // A full store is not worth throwing over a list of names.
  }
}

// Compared case-insensitively, because the same sender is written differently by
// whoever is typing it in and two spellings of one bank read as two senders.
export function addCaptureShortcutSender(
  preferences: CaptureShortcutPreferences,
  name: string,
): CaptureShortcutPreferences {
  const trimmed = name.trim();
  if (!trimmed) return preferences;
  if (preferences.senders.length >= MAX_SENDERS) return preferences;

  const exists = preferences.senders.some(
    (entry) => entry.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exists) return preferences;

  return { senders: [...preferences.senders, trimmed] };
}

export function removeCaptureShortcutSender(
  preferences: CaptureShortcutPreferences,
  name: string,
): CaptureShortcutPreferences {
  return {
    senders: preferences.senders.filter(
      (entry) => entry.toLowerCase() !== name.trim().toLowerCase(),
    ),
  };
}

export function canAddCaptureShortcutSender(preferences: CaptureShortcutPreferences): boolean {
  return preferences.senders.length < MAX_SENDERS;
}
