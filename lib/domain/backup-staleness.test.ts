import { describe, expect, it } from "vitest";

import {
  BACKUP_STALE_AFTER_DAYS,
  isDailyBackupDue,
  readBackupStaleness,
} from "@/lib/domain/backup-staleness";

const NOW = new Date("2026-08-19T09:00:00+03:00");

describe("readBackupStaleness", () => {
  it("reports never when nothing has been backed up", () => {
    expect(readBackupStaleness(undefined, NOW)).toEqual({ state: "never", days: null });
  });

  it("treats an unreadable timestamp as never backed up", () => {
    expect(readBackupStaleness("last tuesday", NOW)).toEqual({
      state: "never",
      days: null,
    });
  });

  it("counts a backup taken earlier today as zero days old", () => {
    expect(readBackupStaleness("2026-08-19T06:00:00.000Z", NOW)).toEqual({
      state: "fresh",
      days: 0,
    });
  });

  it("stays fresh on the day before the threshold", () => {
    expect(readBackupStaleness("2026-08-06T06:00:00.000Z", NOW)).toEqual({
      state: "fresh",
      days: 13,
    });
  });

  it("turns stale exactly on the threshold", () => {
    expect(readBackupStaleness("2026-08-05T06:00:00.000Z", NOW)).toEqual({
      state: "stale",
      days: BACKUP_STALE_AFTER_DAYS,
    });
  });

  it("counts a long-abandoned backup in whole days", () => {
    expect(readBackupStaleness("2026-07-03T06:00:00.000Z", NOW)).toEqual({
      state: "stale",
      days: 47,
    });
  });

  it("counts days in local time, not UTC", () => {
    expect(readBackupStaleness("2026-08-05T21:30:00.000Z", NOW)).toEqual({
      state: "fresh",
      days: 13,
    });
  });

  it("does not go negative when the clock has moved backwards", () => {
    expect(readBackupStaleness("2026-09-01T06:00:00.000Z", NOW)).toEqual({
      state: "fresh",
      days: 0,
    });
  });
});

describe("the daily upload trigger", () => {
  it("is due when nothing has ever been backed up", () => {
    expect(isDailyBackupDue(undefined, new Date("2026-08-19T09:00:00.000Z"))).toBe(true);
  });

  // Local wall-clock times, since a day is the user's day, not UTC's.
  it("is not due again on the same day", () => {
    const earlier = new Date(2026, 7, 19, 0, 30);
    const later = new Date(2026, 7, 19, 23, 30);

    expect(isDailyBackupDue(earlier.toISOString(), later)).toBe(false);
  });

  it("is due the next morning, only hours later", () => {
    const lastNight = new Date(2026, 7, 18, 23, 0);
    const thisMorning = new Date(2026, 7, 19, 7, 0);

    expect(isDailyBackupDue(lastNight.toISOString(), thisMorning)).toBe(true);
  });

  it("treats an unreadable timestamp as never backed up", () => {
    expect(isDailyBackupDue("not a date", new Date("2026-08-19T09:00:00.000Z"))).toBe(true);
  });
});
