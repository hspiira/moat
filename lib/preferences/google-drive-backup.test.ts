import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("google drive backup preferences", () => {
  it("reads defaults when no preferences are stored", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: vi.fn(),
      },
    });

    const { readGoogleDriveBackupPreferences } = await import(
      "@/lib/preferences/google-drive-backup"
    );

    expect(readGoogleDriveBackupPreferences()).toEqual({
      provider: "google_drive",
      wasConnected: false,
    });
  });

  it("persists and re-reads backup metadata", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
    });

    const {
      readGoogleDriveBackupPreferences,
      saveGoogleDriveBackupPreferences,
    } = await import("@/lib/preferences/google-drive-backup");

    saveGoogleDriveBackupPreferences({
      provider: "google_drive",
      wasConnected: true,
      lastBackupAt: "2026-04-07T10:00:00.000Z",
      lastBackupName: "moat-backup.enc",
    });

    expect(readGoogleDriveBackupPreferences()).toEqual({
      provider: "google_drive",
      wasConnected: true,
      lastBackupAt: "2026-04-07T10:00:00.000Z",
      lastBackupName: "moat-backup.enc",
      lastRestoredAt: undefined,
      lastRestoredName: undefined,
    });
  });
});
