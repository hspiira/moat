import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import {
  forgetFinanceDatabaseConnection,
  openFinanceDatabase,
} from "@/lib/repositories/indexeddb/client";

afterEach(() => {
  forgetFinanceDatabaseConnection();
});

describe("the database connection", () => {
  /* Every read used to open its own connection and never close it. A page load
     makes several, and each open connection holds the schema version against
     the next upgrade. */
  it("is opened once and handed out again", async () => {
    const first = await openFinanceDatabase();
    const second = await openFinanceDatabase();

    expect(second).toBe(first);
  });

  it("reconnects when the one it held was closed by someone else", async () => {
    const first = await openFinanceDatabase();
    first.close();

    const second = await openFinanceDatabase();

    expect(second).not.toBe(first);
    // And the replacement is usable, which is the whole point.
    expect(() => second.transaction(second.objectStoreNames[0], "readonly").abort()).not.toThrow();
  });

  it("opens again after the connection is forgotten", async () => {
    const first = await openFinanceDatabase();
    forgetFinanceDatabaseConnection();

    expect(await openFinanceDatabase()).not.toBe(first);
  });
});
