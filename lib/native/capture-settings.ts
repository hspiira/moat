export type NotificationAllowlistEntry = {
  id: string;
  label: string;
  packageName: string;
};

/**
 * A message sender the person can opt into on iOS.
 *
 * iOS never lets an app read messages, so a Shortcut appends them to a file and
 * the person imports it. The Shortcut cannot be changed from here, so this list
 * decides what Moat reads on import instead. Opting a sender out takes effect at
 * once, with no edit in the Shortcuts app.
 */
export type MessageSenderEntry = {
  id: string;
  label: string;
  /** Any of these appearing in a message marks it as from this sender. */
  matchTerms: string[];
};

export type CaptureAutomationSettings = {
  notificationCaptureEnabled: boolean;
  allowedNotificationPackages: string[];
  /** iOS message capture, read on import rather than in the background. */
  messageCaptureEnabled: boolean;
  allowedMessageSenders: string[];
  /** Senders the person added themselves, beyond the built-in catalog. */
  customMessageSenders: MessageSenderEntry[];
};

const STORAGE_KEY = "moat:capture-automation-settings";

export const notificationAllowlistCatalog: NotificationAllowlistEntry[] = [
  { id: "mtn-momo", label: "MTN MoMo", packageName: "com.mtn.uganda.momo" },
  { id: "airtel-money", label: "Airtel Money", packageName: "com.airtel.ug" },
  { id: "stanbic", label: "Stanbic Bank Uganda", packageName: "ug.co.stanbic.mobile" },
  { id: "dfcu", label: "dfcu Bank", packageName: "com.dfcubank.mobile" },
  { id: "centenary", label: "Centenary Bank", packageName: "com.centenary.mobilebanking" },
] as const;

export const messageSenderCatalog: MessageSenderEntry[] = [
  { id: "mtn-momo", label: "MTN MoMo", matchTerms: ["MTN Mobile Money", "MTNMoMo", "MTN MoMo"] },
  { id: "airtel-money", label: "Airtel Money", matchTerms: ["Airtel Money", "AirtelMoney"] },
  { id: "stanbic", label: "Stanbic Bank Uganda", matchTerms: ["Stanbic"] },
  { id: "dfcu", label: "dfcu Bank", matchTerms: ["dfcu"] },
  { id: "centenary", label: "Centenary Bank", matchTerms: ["Centenary", "CenteMobile"] },
  { id: "absa", label: "Absa Bank Uganda", matchTerms: ["Absa"] },
];

export const defaultCaptureAutomationSettings: CaptureAutomationSettings = {
  notificationCaptureEnabled: false,
  allowedNotificationPackages: notificationAllowlistCatalog
    .filter((entry) => entry.id === "mtn-momo" || entry.id === "airtel-money")
    .map((entry) => entry.packageName),
  // Off until asked for. Capture reads money messages, so it starts silent.
  messageCaptureEnabled: false,
  allowedMessageSenders: ["mtn-momo", "airtel-money"],
  customMessageSenders: [],
};

/** The catalog plus anything the person added, ready for the sender filter. */
export function resolveMessageSenders(
  settings: CaptureAutomationSettings,
): MessageSenderEntry[] {
  const all = [...messageSenderCatalog, ...settings.customMessageSenders];
  return all.filter((entry) => settings.allowedMessageSenders.includes(entry.id));
}

export function loadCaptureAutomationSettings(): CaptureAutomationSettings {
  if (typeof window === "undefined") {
    return defaultCaptureAutomationSettings;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultCaptureAutomationSettings;
    }

    const parsed = JSON.parse(raw) as Partial<CaptureAutomationSettings>;
    return {
      notificationCaptureEnabled: Boolean(parsed.notificationCaptureEnabled),
      allowedNotificationPackages: Array.isArray(parsed.allowedNotificationPackages)
        ? parsed.allowedNotificationPackages.filter((value): value is string => typeof value === "string")
        : defaultCaptureAutomationSettings.allowedNotificationPackages,
      messageCaptureEnabled: Boolean(parsed.messageCaptureEnabled),
      allowedMessageSenders: Array.isArray(parsed.allowedMessageSenders)
        ? parsed.allowedMessageSenders.filter((value): value is string => typeof value === "string")
        : defaultCaptureAutomationSettings.allowedMessageSenders,
      customMessageSenders: Array.isArray(parsed.customMessageSenders)
        ? parsed.customMessageSenders.filter(
            (value): value is MessageSenderEntry =>
              typeof value === "object" &&
              value !== null &&
              typeof (value as MessageSenderEntry).id === "string" &&
              typeof (value as MessageSenderEntry).label === "string" &&
              Array.isArray((value as MessageSenderEntry).matchTerms),
          )
        : [],
    };
  } catch {
    return defaultCaptureAutomationSettings;
  }
}

export function saveCaptureAutomationSettings(settings: CaptureAutomationSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
