import { describe, expect, it } from "vitest";

import { storeNames } from "@/lib/repositories/store-names";
import { syncableEntityTypes } from "@/lib/sync/entity-sync";

/* A store added to the app but never registered in entityDefinitions simply
   never syncs, and nothing says so. Same guard the export already has. */
describe("sync completeness", () => {
  /* Every exclusion needs a reason. Adding a store means classifying it here,
     which is the point: the silent default was "does not sync". */
  const notSynced: Record<string, string> = {
    [storeNames.meta]: "schema bookkeeping, not user data",
    [storeNames.resources]: "static content shipped with the app",
    [storeNames.syncProfiles]: "describes this device's relationship to the server",
    [storeNames.syncOutbox]: "what this device still owes; another device's copy is meaningless",
    [storeNames.captureEnvelopes]: "staging for review on the device that captured it",
    [storeNames.captureReviewItems]: "staging; the approved transaction is what syncs",
    [storeNames.imports]: "staging; the transactions an import produced are what sync",
    [storeNames.correctionLogs]: "parser feedback, kept locally and in the export",
  };

  it("registers every store that is not deliberately excluded", () => {
    const registered = new Set<string>(syncableEntityTypes);
    const unaccounted = Object.values(storeNames).filter(
      (store) => !registered.has(store) && !(store in notSynced),
    );

    expect(unaccounted).toEqual([]);
  });

  it("does not exclude a store it also syncs", () => {
    const contradictory = syncableEntityTypes.filter((entity) => entity in notSynced);
    expect(contradictory).toEqual([]);
  });

  it("only excludes stores that exist", () => {
    const stores = new Set<string>(Object.values(storeNames));
    expect(Object.keys(notSynced).filter((store) => !stores.has(store))).toEqual([]);
  });

  it("syncs something", () => {
    expect(syncableEntityTypes.length).toBeGreaterThan(0);
  });
});
