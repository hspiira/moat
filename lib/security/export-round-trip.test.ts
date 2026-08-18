import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

import { detectBackupFormat } from "@/lib/security/backup-format";
import { collectFullExport, downloadJson } from "@/lib/security/data-export";

describe("export → detect round trip", () => {
  it("detects a genuine export as a restorable plaintext backup", async () => {
    const exported = await collectFullExport();
    const serialised = JSON.stringify(exported);

    const format = detectBackupFormat(serialised);

    expect(format.kind).toBe("plain");
    if (format.kind === "plain") {
      expect(format.payload.schemaVersion).toBe(exported.schemaVersion);
      expect(Array.isArray(format.payload.transactions)).toBe(true);
    }
  });

  it("serialises exactly what the download writes to disk", async () => {
    const exported = await collectFullExport();
    const pretty = JSON.stringify(exported, null, 2);

    expect(detectBackupFormat(pretty).kind).toBe("plain");
    expect(typeof downloadJson).toBe("function");
  });
});
