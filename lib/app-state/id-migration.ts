import type { RepositoryBundle } from "@/lib/repositories/types";
import { storeNames, type StoreName } from "@/lib/repositories/store-names";
import { createId, deriveSeededId, isValidId } from "@/lib/ids";
import { GROUP_ID_FIELD, idReferences } from "@/lib/app-state/id-references";
import {
  createLocalStorageJournalStore,
  type IdMigrationJournal,
  type IdMigrationJournalStore,
} from "@/lib/app-state/id-migration-journal";
import { SEEDED_SLUGS, categorySlug } from "@/lib/domain/seeded-ids";
import type { Account, Category, SyncProfile, UserProfile } from "@/lib/types";

type AnyRecord = Record<string, unknown> & { id: string };

export type IdMigrationSummary = {
  migrated: boolean;
  recordsRewritten: number;
  referencesRewritten: number;
  leftoversRemoved: number;
  resumed: boolean;
  dryRun: boolean;
  blocked: boolean;
  reason?: string;
};

export class IdMigrationError extends Error {}

export const MIGRATION_LOCK_MS = 60_000;

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

function seededSlugFor(store: StoreName, record: AnyRecord): string | null {
  if (store === storeNames.accounts) {
    const account = record as unknown as Account;
    if (account.id === "account:money-lent-out") return SEEDED_SLUGS.lendingPool;
    if (account.id === "account:money-borrowed") return SEEDED_SLUGS.borrowingPool;
    return null;
  }

  if (store === storeNames.categories) {
    const category = record as unknown as Category;
    return category.isDefault ? categorySlug(category.name) : null;
  }

  if (store === storeNames.investmentProfiles) {
    return SEEDED_SLUGS.investmentProfile;
  }

  return null;
}

async function readAll(
  repositories: RepositoryBundle,
  userIds: string[],
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
      const found: AnyRecord[] = [];
      for (const id of userIds) {
        const investment = await repositories.investmentProfiles.getByUser(id);
        if (investment) found.push(investment as unknown as AnyRecord);
      }
      byStore.set(store, dedupeById(found));
      continue;
    }

    const repository = bundle[store];
    const rows: AnyRecord[] = [];
    for (const id of userIds) {
      if (repository?.listByUser) rows.push(...(await repository.listByUser(id)));
    }
    byStore.set(store, dedupeById(rows));
  }

  return byStore;
}

function dedupeById(rows: AnyRecord[]): AnyRecord[] {
  const seen = new Map<string, AnyRecord>();
  for (const row of rows) {
    if (!seen.has(row.id)) seen.set(row.id, row);
  }
  return [...seen.values()];
}

function newestWriteAt(records: Map<StoreName, AnyRecord[]>): string | null {
  let newest: string | null = null;

  for (const rows of records.values()) {
    for (const row of rows) {
      for (const field of ["updatedAt", "createdAt"]) {
        const stamp = row[field];
        if (typeof stamp === "string" && (newest === null || stamp > newest)) {
          newest = stamp;
        }
      }
    }
  }

  return newest;
}

function refuse(
  reason: string,
  options: { resumed?: boolean; blocked?: boolean } = {},
): IdMigrationSummary {
  return {
    migrated: false,
    recordsRewritten: 0,
    referencesRewritten: 0,
    leftoversRemoved: 0,
    resumed: options.resumed ?? false,
    dryRun: false,
    blocked: options.blocked ?? false,
    reason,
  };
}

export async function migrateIdsToCuid2(params: {
  repositories: RepositoryBundle;
  userId: string;
  backupTakenAt?: string | null;
  journalStore?: IdMigrationJournalStore;
  dryRun?: boolean;
  now?: Date;
}): Promise<IdMigrationSummary> {
  const { repositories, userId, backupTakenAt = null, dryRun = false } = params;
  const now = params.now ?? new Date();
  const journalStore = params.journalStore ?? createLocalStorageJournalStore();

  const syncProfile = await repositories.syncProfiles.getByUser(userId);
  const outbox = await repositories.syncOutbox.listByUser(userId);

  if (syncProfile?.lastSyncedAt || syncProfile?.backfilledAt || outbox.length > 0) {
    return refuse(
      "This device has already synced. Renumbering now would orphan the records already on the server.",
    );
  }

  const journal = readOwnJournal(journalStore, userId);

  if (journal && !dryRun) {
    const age = now.getTime() - new Date(journal.startedAt).getTime();
    if (age >= 0 && age < MIGRATION_LOCK_MS) {
      return refuse(
        "Another migration is already running on this device. Wait for it to finish, then try again.",
        { resumed: true, blocked: true },
      );
    }
  }

  const userIds = journal ? [userId, journal.newUserId] : [userId];
  const records = await readAll(repositories, [...new Set(userIds)]);

  const profile = records.get(storeNames.userProfiles)?.[0];
  if (!profile) {
    return refuse("No profile to migrate.");
  }

  const newUserId =
    journal?.newUserId ?? (isValidId(profile.id) ? profile.id : createId());

  const plan = planIds(records, newUserId, journal);

  if (!plan.hasWork) {
    if (journal && !dryRun) journalStore.clear();
    return {
      migrated: false,
      recordsRewritten: 0,
      referencesRewritten: 0,
      leftoversRemoved: 0,
      resumed: Boolean(journal),
      dryRun,
      blocked: false,
      reason: "Already migrated.",
    };
  }

  const rewritten = rewriteRecords(records, plan, newUserId);

  if (dryRun) {
    return {
      migrated: false,
      recordsRewritten: plan.rewriteCount,
      referencesRewritten: rewritten.referencesRewritten,
      leftoversRemoved: plan.leftoverCount,
      resumed: Boolean(journal),
      dryRun: true,
      blocked: false,
      reason: "Dry run. Nothing was written.",
    };
  }

  if (!journal) {
    const gate = checkBackupGate(backupTakenAt, newestWriteAt(records));
    if (gate) return refuse(gate, { blocked: true });
  }

  const committed: IdMigrationJournal = journal ?? {
    userId,
    newUserId,
    startedAt: now.toISOString(),
    idMap: plan.serializedIdMap,
    groupIdMap: Object.fromEntries(plan.groupIdMap),
    storesWritten: [],
  };
  committed.idMap = plan.serializedIdMap;
  committed.groupIdMap = Object.fromEntries(plan.groupIdMap);
  journalStore.write(committed);

  await repositories.userProfile.save(
    rewritten.rows.get(storeNames.userProfiles)![0] as unknown as UserProfile,
  );

  const bundle = repositories as unknown as Record<
    string,
    { upsert?: (record: AnyRecord) => Promise<unknown>; remove?: (id: string) => Promise<void> }
  >;

  let recordsRewritten = 1;

  for (const store of migratedStores) {
    if (store === storeNames.userProfiles) continue;
    if (committed.storesWritten.includes(store)) continue;

    if (store === storeNames.investmentProfiles) {
      const investment = rewritten.rows.get(store)?.[0];
      if (investment) {
        await repositories.investmentProfiles.save(investment as never);
        recordsRewritten += 1;
      }
    } else {
      const repository = bundle[store];
      for (const record of rewritten.rows.get(store) ?? []) {
        await repository?.upsert?.(record);
        recordsRewritten += 1;
      }
    }

    committed.storesWritten.push(store);
    journalStore.write(committed);
  }

  let leftoversRemoved = 0;

  for (const store of migratedStores) {
    if (store === storeNames.userProfiles || store === storeNames.investmentProfiles) continue;

    const repository = bundle[store];
    for (const record of records.get(store) ?? []) {
      if (plan.idMap.get(store)?.get(record.id) === record.id) continue;
      await repository?.remove?.(record.id);
      leftoversRemoved += 1;
    }
  }

  if (syncProfile) {
    await repositories.syncProfiles.save({
      ...syncProfile,
      id: deriveSeededId(newUserId, SEEDED_SLUGS.syncProfile),
      userId: newUserId,
      updatedAt: now.toISOString(),
    } as SyncProfile);
  }

  journalStore.clear();

  return {
    migrated: true,
    recordsRewritten,
    referencesRewritten: rewritten.referencesRewritten,
    leftoversRemoved,
    resumed: Boolean(journal),
    dryRun: false,
    blocked: false,
  };
}

function readOwnJournal(
  journalStore: IdMigrationJournalStore,
  userId: string,
): IdMigrationJournal | null {
  const journal = journalStore.read();
  if (!journal) return null;
  return journal.userId === userId || journal.newUserId === userId ? journal : null;
}

function checkBackupGate(
  backupTakenAt: string | null,
  newestWrite: string | null,
): string | null {
  if (!backupTakenAt) {
    return "Take an encrypted backup before switching on sync. This step renumbers every record, and a backup is the only way back.";
  }

  if (newestWrite && backupTakenAt < newestWrite) {
    return "Your last backup is older than your most recent change. Take a fresh backup before switching on sync.";
  }

  return null;
}

type IdPlan = {
  idMap: Map<StoreName, Map<string, string>>;
  serializedIdMap: Record<string, Record<string, string>>;
  groupIdMap: Map<string, string>;
  leftovers: Map<StoreName, Set<string>>;
  leftoverCount: number;
  rewriteCount: number;
  hasWork: boolean;
};

function planIds(
  records: Map<StoreName, AnyRecord[]>,
  newUserId: string,
  journal: IdMigrationJournal | null,
): IdPlan {
  const idMap = new Map<StoreName, Map<string, string>>();
  const leftovers = new Map<StoreName, Set<string>>();
  let leftoverCount = 0;
  let rewriteCount = 0;

  for (const store of migratedStores) {
    const map = new Map<string, string>();
    const rows = records.get(store) ?? [];
    const journalled = journal?.idMap[store] ?? {};

    for (const record of rows) {
      const slug = seededSlugFor(store, record);
      const next =
        journalled[record.id] ??
        (isValidId(record.id)
          ? record.id
          : store === storeNames.userProfiles
            ? newUserId
            : slug
              ? deriveSeededId(newUserId, slug)
              : createId());

      map.set(record.id, next);
      if (next !== record.id) rewriteCount += 1;
    }

    const byTarget = new Map<string, string[]>();
    for (const [from, to] of map) {
      byTarget.set(to, [...(byTarget.get(to) ?? []), from]);
    }

    for (const [target, sources] of byTarget) {
      const moving = sources.filter((source) => source !== target);
      if (moving.length > 1) {
        throw new IdMigrationError(
          `Two ${store} records would end up with the same id (${target}). Nothing was changed.`,
        );
      }
      if (moving.length === 1 && sources.length > 1) {
        leftovers.set(store, (leftovers.get(store) ?? new Set()).add(moving[0]));
        leftoverCount += 1;
        rewriteCount -= 1;
      }
    }

    idMap.set(store, map);
  }

  const groupIdMap = new Map<string, string>(Object.entries(journal?.groupIdMap ?? {}));
  const groupTargets = new Set(groupIdMap.values());

  for (const store of migratedStores) {
    for (const record of records.get(store) ?? []) {
      const groupId = record[GROUP_ID_FIELD];
      if (typeof groupId !== "string" || groupId === "") continue;
      if (groupTargets.has(groupId) || groupIdMap.has(groupId)) continue;
      if (isValidId(groupId)) {
        groupTargets.add(groupId);
        continue;
      }
      const mapped = createId();
      groupIdMap.set(groupId, mapped);
      groupTargets.add(mapped);
    }
  }

  const serializedIdMap: Record<string, Record<string, string>> = {};
  for (const [store, map] of idMap) {
    serializedIdMap[store] = Object.fromEntries(map);
  }

  return {
    idMap,
    serializedIdMap,
    groupIdMap,
    leftovers,
    leftoverCount,
    rewriteCount,
    hasWork: rewriteCount > 0 || leftoverCount > 0,
  };
}

function rewriteRecords(
  records: Map<StoreName, AnyRecord[]>,
  plan: IdPlan,
  newUserId: string,
): { rows: Map<StoreName, AnyRecord[]>; referencesRewritten: number } {
  const rows = new Map<StoreName, AnyRecord[]>();
  let referencesRewritten = 0;

  for (const store of migratedStores) {
    const next: AnyRecord[] = [];

    for (const record of records.get(store) ?? []) {
      if (plan.leftovers.get(store)?.has(record.id)) continue;

      const copy = structuredClone(record) as AnyRecord;
      copy.id = plan.idMap.get(store)!.get(record.id)!;

      if (store !== storeNames.userProfiles && "userId" in copy) {
        copy.userId = newUserId;
      }

      for (const reference of idReferences[store] ?? []) {
        const current = getPath(copy, reference.path);
        if (typeof current !== "string" || current === "") {
          continue;
        }

        const mapped = plan.idMap.get(reference.target)?.get(current);
        if (!mapped) {
          if (isValidId(current)) continue;
          throw new IdMigrationError(
            `${store}.${reference.path} on record ${record.id} points at ${reference.target} ${current}, which does not exist. Nothing was changed.`,
          );
        }

        setPath(copy, reference.path, mapped);
        referencesRewritten += 1;
      }

      const groupId = copy[GROUP_ID_FIELD];
      if (typeof groupId === "string" && groupId !== "") {
        const mappedGroup = plan.groupIdMap.get(groupId);
        if (mappedGroup) {
          copy[GROUP_ID_FIELD] = mappedGroup;
          referencesRewritten += 1;
        }
      }

      next.push(copy);
    }

    rows.set(store, next);
  }

  return { rows, referencesRewritten };
}
