"use client";

const CAPTURE_SHORTCUT_PREFERENCES_KEY = "moat.capture-shortcut";

// Enough for every bank and wallet someone actually hears from, and low enough
// that a runaway write cannot fill the store the ledger shares.
const MAX_SENDERS = 20;

export type CaptureShortcutSender = {
  /** The name as it appears on the message. */
  name: string;
  /**
   * The account this sender's money moves on.
   *
   * Held rather than guessed, because a sender is not written the way an account
   * is named: nothing spells "MTNMobMoney" and "MTN MoMo" close enough for one
   * to be read from the other, and money on the wrong account is a wrong
   * balance.
   */
  accountId?: string;
};

export type CaptureShortcutPreferences = {
  senders: CaptureShortcutSender[];
};

export const defaultCaptureShortcutPreferences: CaptureShortcutPreferences = { senders: [] };

// The list held plain names before it held accounts, so what is already stored
// on a device has to keep working.
function readSender(value: unknown): CaptureShortcutSender | null {
  if (typeof value === "string") {
    return value.trim() ? { name: value.trim() } : null;
  }

  if (typeof value !== "object" || value === null) return null;

  const entry = value as { name?: unknown; accountId?: unknown };
  if (typeof entry.name !== "string" || !entry.name.trim()) return null;

  return {
    name: entry.name.trim(),
    accountId:
      typeof entry.accountId === "string" && entry.accountId.trim()
        ? entry.accountId.trim()
        : undefined,
  };
}

export function readCaptureShortcutPreferences(): CaptureShortcutPreferences {
  if (typeof window === "undefined") return defaultCaptureShortcutPreferences;

  try {
    const raw = window.localStorage.getItem(CAPTURE_SHORTCUT_PREFERENCES_KEY);
    if (!raw) return defaultCaptureShortcutPreferences;

    const parsed = JSON.parse(raw) as { senders?: unknown };
    const senders = Array.isArray(parsed.senders)
      ? parsed.senders
          .map(readSender)
          .filter((sender): sender is CaptureShortcutSender => sender !== null)
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

function sameName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
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
  if (preferences.senders.some((sender) => sameName(sender.name, trimmed))) return preferences;

  return { senders: [...preferences.senders, { name: trimmed }] };
}

export function removeCaptureShortcutSender(
  preferences: CaptureShortcutPreferences,
  name: string,
): CaptureShortcutPreferences {
  return {
    senders: preferences.senders.filter((sender) => !sameName(sender.name, name)),
  };
}

export function setCaptureShortcutSenderAccount(
  preferences: CaptureShortcutPreferences,
  name: string,
  accountId: string | undefined,
): CaptureShortcutPreferences {
  return {
    senders: preferences.senders.map((sender) =>
      sameName(sender.name, name) ? { ...sender, accountId: accountId || undefined } : sender,
    ),
  };
}

/** The account a message from this sender belongs on, if one was chosen. */
export function accountIdForSender(
  preferences: CaptureShortcutPreferences,
  sender: string | undefined,
): string | undefined {
  if (!sender?.trim()) return undefined;
  return preferences.senders.find((entry) => sameName(entry.name, sender))?.accountId;
}

export function captureShortcutSenderNames(preferences: CaptureShortcutPreferences): string[] {
  return preferences.senders.map((sender) => sender.name);
}

export function canAddCaptureShortcutSender(preferences: CaptureShortcutPreferences): boolean {
  return preferences.senders.length < MAX_SENDERS;
}
