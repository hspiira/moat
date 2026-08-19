import { describe, expect, it } from "vitest";

import {
  LOCKED_FOR_SEALED_RESTORE,
  PIN_NEEDED_FOR_ENCRYPTED_RESTORE,
  planBackupRestore,
} from "@/lib/domain/backup-restore-plan";
import type { BackupFormat } from "@/lib/security/backup-format";

const sealed = { kind: "sealed", payload: {} } as unknown as BackupFormat;
const encrypted = { kind: "encrypted", payload: {} } as unknown as BackupFormat;
const plain = { kind: "plain", payload: {} } as unknown as BackupFormat;
const unrecognised: BackupFormat = { kind: "unrecognised", reason: "Not a backup." };

const unlocked = { hasDeviceKey: true, pinLength: 0 };
const locked = { hasDeviceKey: false, pinLength: 0 };

describe("planBackupRestore", () => {
  it("never asks for a PIN for a sealed backup, because none was set when it was made", () => {
    expect(planBackupRestore(sealed, unlocked)).toEqual({ action: "sealed" });
  });

  it("opens a sealed backup even when a PIN happens to be typed", () => {
    expect(planBackupRestore(sealed, { hasDeviceKey: true, pinLength: 6 })).toEqual({
      action: "sealed",
    });
  });

  it("says to unlock rather than blaming the PIN when a sealed backup is opened locked", () => {
    expect(planBackupRestore(sealed, locked)).toEqual({
      action: "refuse",
      reason: LOCKED_FOR_SEALED_RESTORE,
    });
  });

  it("still asks for the PIN on a backup that was made with one", () => {
    expect(planBackupRestore(encrypted, { hasDeviceKey: true, pinLength: 0 })).toEqual({
      action: "refuse",
      reason: PIN_NEEDED_FOR_ENCRYPTED_RESTORE,
    });
  });

  it("opens a PIN backup once the PIN is long enough", () => {
    expect(planBackupRestore(encrypted, { hasDeviceKey: false, pinLength: 6 })).toEqual({
      action: "encrypted",
    });
  });

  it("restores a plain export without a key or a PIN", () => {
    expect(planBackupRestore(plain, locked)).toEqual({ action: "plain" });
  });

  it("passes on the reason a file was not recognised", () => {
    expect(planBackupRestore(unrecognised, unlocked)).toEqual({
      action: "refuse",
      reason: "Not a backup.",
    });
  });
});
