import type { CategoryMergePlan } from "@/lib/domain/category-merge";
import { repositories } from "@/lib/repositories/instance";

type AnyRecord = Record<string, unknown> & { id: string };

type CategoryReferrer = {
  list: (userId: string) => Promise<AnyRecord[]>;
  save: (record: AnyRecord) => Promise<unknown>;
  fields: string[];
};

function referrer<T extends { id: string }>(
  repository: {
    listByUser: (userId: string) => Promise<T[]>;
    upsert: (entity: T) => Promise<T>;
  },
  fields: Array<keyof T & string>,
): CategoryReferrer {
  return {
    list: async (userId) => (await repository.listByUser(userId)) as unknown as AnyRecord[],
    save: (record) => repository.upsert(record as unknown as T),
    fields,
  };
}

// Correction logs and the capture snapshots are deliberately absent: they record
// what was true when the record was captured, not where the money sits now.
function categoryReferrers(): CategoryReferrer[] {
  return [
    referrer(repositories.transactions, ["categoryId"]),
    referrer(repositories.transactionLineItems, ["categoryId"]),
    referrer(repositories.budgets, ["categoryId"]),
    referrer(repositories.recurringObligations, ["categoryId"]),
    referrer(repositories.transactionRules, ["categoryId", "effectCategoryId"]),
    referrer(repositories.captureReviewItems, ["categoryId"]),
    referrer(repositories.items, ["defaultCategoryId"]),
  ];
}

export type CategoryReferenceCounts = Map<string, number>;

export async function loadCategoryReferenceCounts(
  userId: string,
): Promise<CategoryReferenceCounts> {
  const counts: CategoryReferenceCounts = new Map();

  await Promise.all(
    categoryReferrers().map(async (reference) => {
      for (const record of await reference.list(userId)) {
        for (const field of reference.fields) {
          const value = record[field];
          if (typeof value === "string" && value !== "") {
            counts.set(value, (counts.get(value) ?? 0) + 1);
          }
        }
      }
    }),
  );

  return counts;
}

export async function moveCategoryReferences(params: {
  userId: string;
  moves: Array<{ fromId: string; toId: string }>;
  timestamp: string;
}): Promise<number> {
  const { userId, moves, timestamp } = params;
  if (moves.length === 0) return 0;

  const destination = new Map(moves.map((move) => [move.fromId, move.toId]));
  let rewritten = 0;

  for (const reference of categoryReferrers()) {
    const records = await reference.list(userId);

    for (const record of records) {
      const next = { ...record };
      let changed = false;

      for (const field of reference.fields) {
        const value = next[field];
        if (typeof value !== "string") continue;
        const moved = destination.get(value);
        if (!moved) continue;
        next[field] = moved;
        changed = true;
      }

      if (!changed) continue;
      if (typeof next.updatedAt === "string") {
        next.updatedAt = timestamp;
      }
      await reference.save(next);
      rewritten += 1;
    }
  }

  return rewritten;
}

export type CategoryMergeResult = {
  removedIds: string[];
  recordsRewritten: number;
};

export async function applyCategoryMerge(params: {
  userId: string;
  plan: CategoryMergePlan;
  timestamp: string;
}): Promise<CategoryMergeResult> {
  const { userId, plan, timestamp } = params;
  if (plan.removedIds.length === 0 && plan.survivors.length === 0) {
    return { removedIds: [], recordsRewritten: 0 };
  }

  await Promise.all(plan.survivors.map((category) => repositories.categories.upsert(category)));
  const recordsRewritten = await moveCategoryReferences({
    userId,
    moves: plan.moves,
    timestamp,
  });
  await Promise.all(plan.removedIds.map((id) => repositories.categories.remove(id)));

  return { removedIds: plan.removedIds, recordsRewritten };
}
