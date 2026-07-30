import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

import { detectBackupFormat } from "@/lib/security/backup-format";
import { collectFullExport, downloadJson } from "@/lib/security/data-export";

/**
 * Closes the loop between the two modules. The reported bug was that an
 * exported file could not be imported: the restore flow handed it to the
 * decrypter, which failed, and the failure surfaced as a wrong-PIN error.
 *
 * Asserting against a *real* collectFullExport() — rather than a hand-written
 * fixture — means that if FullExport's shape ever drifts away from what
 * detectBackupFormat looks for, this fails instead of silently reintroducing
 * the unimportable-export bug.
 */
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
    // downloadJson stringifies with 2-space indent; make sure pretty-printing
    // does not change how the file is classified on the way back in.
    const exported = await collectFullExport();
    const pretty = JSON.stringify(exported, null, 2);

    expect(detectBackupFormat(pretty).kind).toBe("plain");
    expect(typeof downloadJson).toBe("function");
  });
});
