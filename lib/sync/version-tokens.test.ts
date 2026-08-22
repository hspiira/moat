import { describe, expect, it } from "vitest";

import {
  buildVersionRecord,
  tokenLookup,
  versionRecordId,
  versionRecordsFromPull,
  versionRecordsFromPush,
} from "@/lib/sync/version-tokens";

const USER = "user:ada";
const STAMP = "2026-08-22T10:00:00.000Z";

describe("versionRecordId", () => {
  it("keeps one owner's record apart from another's", () => {
    expect(versionRecordId("user:a", "categories", "c1")).not.toBe(
      versionRecordId("user:b", "categories", "c1"),
    );
  });

  it("keeps the same id for the same record, so a token is replaced not piled up", () => {
    expect(versionRecordId(USER, "categories", "c1")).toBe(
      versionRecordId(USER, "categories", "c1"),
    );
  });
});

describe("versionRecordsFromPull", () => {
  it("remembers the token that came with each record", () => {
    const records = versionRecordsFromPull({
      userId: USER,
      timestamp: STAMP,
      records: [
        {
          entityType: "categories",
          entityId: "c1",
          payload: "{}",
          deleted: false,
          updatedAt: STAMP,
          serverVersionToken: "sv:1",
        },
      ],
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ entityId: "c1", serverVersionToken: "sv:1" });
  });

  it("skips a record that carried no token", () => {
    const records = versionRecordsFromPull({
      userId: USER,
      timestamp: STAMP,
      records: [
        {
          entityType: "categories",
          entityId: "c1",
          payload: "{}",
          deleted: false,
          updatedAt: STAMP,
          serverVersionToken: "",
        },
      ],
    });

    expect(records).toEqual([]);
  });
});

describe("versionRecordsFromPush", () => {
  const pushed = [{ outboxId: "o1", entityType: "categories", entityId: "c1" }];

  it("remembers the token a successful push came back with", () => {
    const records = versionRecordsFromPush({
      userId: USER,
      timestamp: STAMP,
      pushed,
      results: [{ outboxId: "o1", status: "synced", serverVersionToken: "sv:2" }],
    });

    expect(records[0]).toMatchObject({ entityId: "c1", serverVersionToken: "sv:2" });
  });

  it("takes the server's own token from a conflict, so the retry is not rejected again", () => {
    const records = versionRecordsFromPush({
      userId: USER,
      timestamp: STAMP,
      pushed,
      results: [
        {
          outboxId: "o1",
          status: "conflict",
          serverRecord: {
            entityType: "categories",
            entityId: "c1",
            payload: "{}",
            deleted: false,
            updatedAt: STAMP,
            serverVersionToken: "sv:server",
          },
        },
      ],
    });

    expect(records[0].serverVersionToken).toBe("sv:server");
  });

  it("has nothing to remember for a result it cannot place", () => {
    const records = versionRecordsFromPush({
      userId: USER,
      timestamp: STAMP,
      pushed,
      results: [{ outboxId: "unknown", status: "synced", serverVersionToken: "sv:2" }],
    });

    expect(records).toEqual([]);
  });

  it("has nothing to remember when the push came back without a token", () => {
    const records = versionRecordsFromPush({
      userId: USER,
      timestamp: STAMP,
      pushed,
      results: [{ outboxId: "o1", status: "failed", error: "offline" }],
    });

    expect(records).toEqual([]);
  });
});

describe("tokenLookup", () => {
  it("finds a token by what it belongs to", () => {
    const lookup = tokenLookup([
      buildVersionRecord({
        userId: USER,
        entityType: "categories",
        entityId: "c1",
        serverVersionToken: "sv:1",
        timestamp: STAMP,
      }),
    ]);

    expect(lookup.get("categories:c1")).toBe("sv:1");
    expect(lookup.get("categories:c2")).toBeUndefined();
  });
});
