/**
 * One-time migration of a device's records to cuid2 ids.
 *
 * Every record gets a new id and every reference is repointed in the same pass.
 * Seeded records take their derived id so they still converge across devices;
 * everything else gets a fresh random one.
 *
 * It refuses to run once a device has synced. The server would still hold the
 * old ids, and rewriting them locally would orphan every record already up
 * there rather than update it.
 *
 * Nothing is written until the whole graph has been rewritten and checked, so a
 * reference the map cannot resolve aborts the migration with the device
 * untouched rather than half-renumbered.
 */

import type { RepositoryBundle } from "@/lib/repositories/types";
import { storeNames, type StoreName } from "@/lib/repositories/store-names";
import { createId, deriveSeededId, isValidId } from "@/lib/ids";
import { GROUP_ID_FIELD, idReferences } from "@/lib/app-state/id-references";
import { SEEDED_SLUGS, categorySlug } from "@/lib/domain/seeded-ids";
import type { Account, Category, SyncProfile, UserProfile } from "@/lib/types";

type AnyRecord = Record<string, unknown> & { id: string };

export type IdMigrationSummary = {
  migrated: boolean;
  recordsRewritten: number;
  referencesRewritten: number;
  reason?: string;
};

export class IdMigrationError extends Error {}

/** Stores holding user records, in dependency-free order. Resources are global. */
const migratedStores: StoreName[] = [
  storeNames.userProfiles,
  storeNames.accounts,
  storeNames.categories,
  storeNames.counterparties,
  storeNames.items,
  storeNames.imports,
  storeNames.captureEnvelopes,
  storeNames.transactions,
  storeNames.transactionLineItems,
  storeNames.plannedPurchases,
  storeNames.goals,
  storeNames.budgets,
  storeNames.monthCloses,
  storeNames.recurringObligations,
  storeNames.transactionRules,
  storeNames.investmentProfiles,
  storeNames.captureReviewItems,
  storeNames.correctionLogs,
];

function getPath(record: AnyRecord, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      record,
    );
}

function setPath(record: AnyRecord, path: string, next: string) {
  const keys = path.split(".");
  const last = keys.pop() as string;
  let target: Record<string, unknown> = record;

  for (const key of keys) {
    const child = target[key];
    if (!child || typeof child !== "object") {
      return;
    }
    target = child as Record<string, unknown>;
  }

  target[last] = next;
}

/**
 * The slug a seeded record derives from, or null when the user created it.
 *
 * Matched on the id the record already carries, which is what the old
 * deterministic scheme produced.
 */
function seededSlugFor(store: StoreName, record: AnyRecord): string | null {
  if (store === storeNames.accounts) {
    const account = record as unknown as Account;
    if (account.id === "account:money-lent-out") return SEEDED_SLUGS.lendingPool;
    if (account.id === "account:money-borrowed") return SEEDED_SLUGS.borrowingPool;
    return null;
  }

  if (store === storeNames.categories) {
    const category = record as unknown as Category;
    // Only app-seeded categories derive; one the user made keeps a random id
    // even if its name happens to match a default.
    return category.isDefault ? categorySlug(category.name) : null;
  }

  if (store === storeNames.investmentProfiles) {
    return SEEDED_SLUGS.investmentProfile;
  }

  return null;
}

function alreadyMigrated(records: Map<StoreName, AnyRecord[]>): boolean {
  const all = [...records.values()].flat();
  return all.length > 0 && all.every((record) => isValidId(record.id));
}

async function readAll(
  repositories: RepositoryBundle,
  userId: string,
): Promise<Map<StoreName, AnyRecord[]>> {
  const bundle = repositories as unknown as Record<
    string,
    { listByUser?: (id: string) => Promise<AnyRecord[]> }
  >;

  const byStore = new Map<StoreName, AnyRecord[]>();

  for (const store of migratedStores) {
    if (store === storeNames.userProfiles) {
      const profile = await repositories.userProfile.get();
      byStore.set(store, profile ? [profile as unknown as AnyRecord] : []);
      continue;
    }
    if (store === storeNames.investmentProfiles) {
      const investment = await repositories.investmentProfiles.getByUser(userId);
      byStore.set(store, investment ? [investment as unknown as AnyRecord] : []);
      continue;
    }

    const repository = bundle[store];
    const rows = repository?.listByUser ? await repository.listByUser(userId) : [];
    // Copied: the write pass below mutates these stores, and a backend that
    // hands back its own array would otherwise grow the list we are iterating.
    byStore.set(store, [...rows]);
  }

  return byStore;
}

export async function migrateIdsToCuid2(params: {
  repositories: RepositoryBundle;
  userId: string;
}): Promise<IdMigrationSummary> {
  const { repositories, userId } = params;

  const syncProfile = await repositories.syncProfiles.getByUser(userId);
  const outbox = await repositories.syncOutbox.listByUser(userId);

  if (syncProfile?.lastSyncedAt || syncProfile?.backfilledAt || outbox.length > 0) {
    return {
      migrated: false,
      recordsRewritten: 0,
      referencesRewritten: 0,
      reason:
        "This device has already synced. Renumbering now would orphan the records already on the server.",
    };
  }

  const records = await readAll(repositories, userId);

  if (alreadyMigrated(records)) {
    return { migrated: false, recordsRewritten: 0, referencesRewritten: 0, reason: "Already migrated." };
  }

  // The profile id is the derivation input for every seeded record, so it has
  // to be settled before anything else can be given an id.
  const profile = records.get(storeNames.userProfiles)?.[0];
  if (!profile) {
    return { migrated: false, recordsRewritten: 0, referencesRewritten: 0, reason: "No profile to migrate." };
  }
  const newUserId = isValidId(profile.id) ? profile.id : createId();

  // old id -> new id, per store, so two stores can reuse an id without clashing.
  const idMap = new Map<StoreName, Map<string, string>>();

  for (const store of migratedStores) {
    const map = new Map<string, string>();
    const taken = new Set<string>();

    for (const record of records.get(store) ?? []) {
      const slug = seededSlugFor(store, record);
      const next =
        store === storeNames.userProfiles
          ? newUserId
          : slug
            ? deriveSeededId(newUserId, slug)
            : createId();

      if (taken.has(next)) {
        throw new IdMigrationError(
          `Two ${store} records would end up with the same id (${next}). Nothing was changed.`,
        );
      }

      taken.add(next);
      map.set(record.id, next);
    }

    idMap.set(store, map);
  }

  const groupIdMap = new Map<string, string>();
  let referencesRewritten = 0;

  const rewritten = new Map<StoreName, AnyRecord[]>();

  for (const store of migratedStores) {
    const next: AnyRecord[] = [];

    for (const record of records.get(store) ?? []) {
      const copy = structuredClone(record) as AnyRecord;
      copy.id = idMap.get(store)!.get(record.id)!;

      if (store !== storeNames.userProfiles && "userId" in copy) {
        copy.userId = newUserId;
      }

      for (const reference of idReferences[store] ?? []) {
        const current = getPath(copy, reference.path);
        if (typeof current !== "string" || current === "") {
          continue;
        }

        const mapped = idMap.get(reference.target)?.get(current);
        if (!mapped) {
          throw new IdMigrationError(
            `${store}.${reference.path} on record ${record.id} points at ${reference.target} ${current}, which does not exist. Nothing was changed.`,
          );
        }

        setPath(copy, reference.path, mapped);
        referencesRewritten += 1;
      }

      const groupId = copy[GROUP_ID_FIELD];
      if (typeof groupId === "string" && groupId !== "") {
        const mappedGroup = groupIdMap.get(groupId) ?? createId();
        groupIdMap.set(groupId, mappedGroup);
        copy[GROUP_ID_FIELD] = mappedGroup;
        referencesRewritten += 1;
      }

      next.push(copy);
    }

    rewritten.set(store, next);
  }

  // Everything resolved. Write the profile first so the new userId exists
  // before records scoped to it land.
  await repositories.userProfile.save(
    rewritten.get(storeNames.userProfiles)![0] as unknown as UserProfile,
  );

  const bundle = repositories as unknown as Record<
    string,
    { upsert?: (record: AnyRecord) => Promise<unknown>; remove?: (id: string) => Promise<void> }
  >;

  let recordsRewritten = 1;

  for (const store of migratedStores) {
    if (store === storeNames.userProfiles) continue;

    if (store === storeNames.investmentProfiles) {
      const investment = rewritten.get(store)?.[0];
      if (investment) {
        await repositories.investmentProfiles.save(investment as never);
        recordsRewritten += 1;
      }
      continue;
    }

    const repository = bundle[store];
    for (const record of rewritten.get(store) ?? []) {
      await repository?.upsert?.(record);
      recordsRewritten += 1;
    }
  }

  // Old rows are only dropped once their replacements are stored, so an
  // interruption leaves duplicates rather than losing data.
  for (const store of migratedStores) {
    if (store === storeNames.userProfiles || store === storeNames.investmentProfiles) continue;

    const repository = bundle[store];
    for (const record of records.get(store) ?? []) {
      if (idMap.get(store)?.get(record.id) === record.id) continue;
      await repository?.remove?.(record.id);
    }
  }

  if (syncProfile) {
    await repositories.syncProfiles.save({
      ...syncProfile,
      id: deriveSeededId(newUserId, SEEDED_SLUGS.syncProfile),
      userId: newUserId,
      updatedAt: new Date().toISOString(),
    } as SyncProfile);
  }

  return { migrated: true, recordsRewritten, referencesRewritten };
}
