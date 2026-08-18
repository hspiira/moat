import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string };

const stores: Record<string, Row[]> = {
  transactions: [],
  transactionLineItems: [],
  budgets: [],
  recurringObligations: [],
  transactionRules: [],
  captureReviewItems: [],
  items: [],
  categories: [],
  correctionLogs: [],
};

function store(name: string) {
  return {
    listByUser: async () => stores[name],
    upsert: async (record: Row) => {
      stores[name] = stores[name].map((row) => (row.id === record.id ? record : row));
      return record;
    },
    remove: async (id: string) => {
      stores[name] = stores[name].filter((row) => row.id !== id);
    },
  };
}

vi.mock("@/lib/repositories/instance", () => ({
  repositories: new Proxy({} as Record<string, unknown>, {
    get: (_target, name: string) => store(name),
  }),
}));

const {
  applyCategoryMerge,
  loadCategoryReferenceCounts,
  moveCategoryReferences,
} = await import("@/lib/repositories/category-references");

const NOW = "2026-08-18T10:00:00.000Z";

beforeEach(() => {
  for (const name of Object.keys(stores)) stores[name] = [];
});

describe("loadCategoryReferenceCounts", () => {
  it("counts every live reference, not just transactions", async () => {
    stores.transactions = [{ id: "t1", categoryId: "c:old" }];
    stores.budgets = [{ id: "b1", categoryId: "c:old" }];
    stores.transactionRules = [{ id: "r1", categoryId: "c:old", effectCategoryId: "c:old" }];
    stores.items = [{ id: "i1", defaultCategoryId: "c:new" }];

    const counts = await loadCategoryReferenceCounts("u1");

    expect(counts.get("c:old")).toBe(4);
    expect(counts.get("c:new")).toBe(1);
  });

  it("ignores an empty reference", async () => {
    stores.transactionRules = [{ id: "r1", categoryId: "", effectCategoryId: undefined }];

    expect((await loadCategoryReferenceCounts("u1")).size).toBe(0);
  });
});

describe("moveCategoryReferences", () => {
  it("repoints every store that files under a category", async () => {
    stores.transactions = [
      { id: "t1", categoryId: "c:old", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "t2", categoryId: "c:keep", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    stores.budgets = [{ id: "b1", categoryId: "c:old", updatedAt: "2026-01-01T00:00:00.000Z" }];
    stores.transactionRules = [{ id: "r1", categoryId: "c:x", effectCategoryId: "c:old" }];

    const rewritten = await moveCategoryReferences({
      userId: "u1",
      moves: [{ fromId: "c:old", toId: "c:keep" }],
      timestamp: NOW,
    });

    expect(rewritten).toBe(3);
    expect(stores.transactions.map((row) => row.categoryId)).toEqual(["c:keep", "c:keep"]);
    expect(stores.budgets[0].categoryId).toBe("c:keep");
    expect(stores.transactionRules[0]).toMatchObject({
      categoryId: "c:x",
      effectCategoryId: "c:keep",
    });
  });

  it("stamps updatedAt only where the record carries one", async () => {
    stores.transactions = [
      { id: "t1", categoryId: "c:old", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    stores.items = [{ id: "i1", defaultCategoryId: "c:old" }];

    await moveCategoryReferences({
      userId: "u1",
      moves: [{ fromId: "c:old", toId: "c:keep" }],
      timestamp: NOW,
    });

    expect(stores.transactions[0].updatedAt).toBe(NOW);
    expect(stores.items[0].updatedAt).toBeUndefined();
  });

  it("leaves the correction log alone, because it records what was true then", async () => {
    stores.transactions = [{ id: "t1", categoryId: "c:old" }];
    stores.correctionLogs = [
      { id: "log:1", approvedSnapshot: { categoryId: "c:old" } },
    ];

    await moveCategoryReferences({
      userId: "u1",
      moves: [{ fromId: "c:old", toId: "c:keep" }],
      timestamp: NOW,
    });

    expect(stores.correctionLogs[0].approvedSnapshot).toEqual({ categoryId: "c:old" });
    expect((await loadCategoryReferenceCounts("u1")).get("c:old")).toBeUndefined();
  });
});

describe("applyCategoryMerge", () => {
  it("repoints before it removes, so nothing is left dangling", async () => {
    stores.categories = [
      { id: "c:keep", name: "Rent" },
      { id: "c:old", name: "Rent" },
    ];
    stores.transactions = [{ id: "t1", categoryId: "c:old" }];

    const result = await applyCategoryMerge({
      userId: "u1",
      plan: {
        survivors: [],
        moves: [{ fromId: "c:old", toId: "c:keep" }],
        removedIds: ["c:old"],
      },
      timestamp: NOW,
    });

    expect(result).toMatchObject({ removedIds: ["c:old"], recordsRewritten: 1 });
    expect(stores.categories.map((row) => row.id)).toEqual(["c:keep"]);
    expect(stores.transactions[0].categoryId).toBe("c:keep");
  });

  it("does nothing when the plan is empty", async () => {
    stores.transactions = [{ id: "t1", categoryId: "c:old" }];

    const result = await applyCategoryMerge({
      userId: "u1",
      plan: { survivors: [], moves: [], removedIds: [] },
      timestamp: NOW,
    });

    expect(result.recordsRewritten).toBe(0);
    expect(stores.transactions[0].categoryId).toBe("c:old");
  });
});
