import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hasUnresolvedAutoBackupFailure,
  type GoogleDriveBackupPreferences,
} from "@/lib/preferences/google-drive-backup";

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
      autoBackupEnabled: false,
    });
  });

  /* This is written from the failure path of a backup, and a device short of
     room is the likeliest reason that backup failed, so the store refusing the
     write must not throw where the caller has already given up. */
  it("does not throw when the store refuses the write", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });

    const { saveGoogleDriveBackupPreferences } = await import(
      "@/lib/preferences/google-drive-backup"
    );

    expect(() =>
      saveGoogleDriveBackupPreferences({
        provider: "google_drive",
        wasConnected: true,
        autoBackupEnabled: true,
        lastAutoBackupErrorAt: "2026-04-07T10:00:00.000Z",
      }),
    ).not.toThrow();
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

    const { readGoogleDriveBackupPreferences, saveGoogleDriveBackupPreferences } = await import(
      "@/lib/preferences/google-drive-backup"
    );

    saveGoogleDriveBackupPreferences({
      provider: "google_drive",
      wasConnected: true,
      autoBackupEnabled: true,
      lastBackupAt: "2026-04-07T10:00:00.000Z",
      lastBackupName: "moat-backup.enc",
    });

    expect(readGoogleDriveBackupPreferences()).toEqual({
      provider: "google_drive",
      wasConnected: true,
      autoBackupEnabled: true,
      lastBackupAt: "2026-04-07T10:00:00.000Z",
      lastBackupName: "moat-backup.enc",
      lastAutoBackupErrorAt: undefined,
      lastAutoBackupAt: undefined,
      lastRestoredAt: undefined,
      lastRestoredName: undefined,
    });
  });
});

describe("hasUnresolvedAutoBackupFailure", () => {
  const base: GoogleDriveBackupPreferences = {
    provider: "google_drive",
    wasConnected: true,
    autoBackupEnabled: true,
  };

  it("says nothing when no automatic backup has failed", () => {
    expect(hasUnresolvedAutoBackupFailure(base)).toBe(false);
  });

  /* The device whose very first automatic backup failed has no success to
     compare against, and is the one most in need of being told. */
  it("reports a failure on a device that has never had one succeed", () => {
    expect(
      hasUnresolvedAutoBackupFailure({
        ...base,
        lastAutoBackupErrorAt: "2026-04-07T10:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("stays quiet once a later backup has succeeded", () => {
    expect(
      hasUnresolvedAutoBackupFailure({
        ...base,
        lastAutoBackupErrorAt: "2026-04-07T10:00:00.000Z",
        lastAutoBackupAt: "2026-04-07T11:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("reports a failure that came after the last success", () => {
    expect(
      hasUnresolvedAutoBackupFailure({
        ...base,
        lastAutoBackupErrorAt: "2026-04-07T12:00:00.000Z",
        lastAutoBackupAt: "2026-04-07T11:00:00.000Z",
      }),
    ).toBe(true);
  });

  /* Comparing unreadable stamps as dates yields NaN, and every comparison
     against NaN is false, so the quiet answer is the one a bad value would
     otherwise get. */
  it("speaks up rather than staying quiet when a stamp cannot be read", () => {
    expect(
      hasUnresolvedAutoBackupFailure({ ...base, lastAutoBackupErrorAt: "not-a-date" }),
    ).toBe(true);
    expect(
      hasUnresolvedAutoBackupFailure({
        ...base,
        lastAutoBackupErrorAt: "2026-04-07T12:00:00.000Z",
        lastAutoBackupAt: "not-a-date",
      }),
    ).toBe(true);
  });
});
