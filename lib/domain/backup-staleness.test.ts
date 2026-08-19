import { describe, expect, it } from "vitest";

import {
  BACKUP_STALE_AFTER_DAYS,
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
