export type NotificationAllowlistEntry = {
  id: string;
  label: string;
  packageName: string;
};

export type CaptureAutomationSettings = {
  notificationCaptureEnabled: boolean;
  allowedNotificationPackages: string[];
};

const STORAGE_KEY = "moat:capture-automation-settings";

export const notificationAllowlistCatalog: NotificationAllowlistEntry[] = [
  { id: "mtn-momo", label: "MTN MoMo", packageName: "com.mtn.uganda.momo" },
  { id: "airtel-money", label: "Airtel Money", packageName: "com.airtel.ug" },
  { id: "stanbic", label: "Stanbic Bank Uganda", packageName: "ug.co.stanbic.mobile" },
  { id: "dfcu", label: "dfcu Bank", packageName: "com.dfcubank.mobile" },
  { id: "centenary", label: "Centenary Bank", packageName: "com.centenary.mobilebanking" },
] as const;

export const defaultCaptureAutomationSettings: CaptureAutomationSettings = {
  notificationCaptureEnabled: false,
  allowedNotificationPackages: notificationAllowlistCatalog
    .filter((entry) => entry.id === "mtn-momo" || entry.id === "airtel-money")
    .map((entry) => entry.packageName),
};

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
