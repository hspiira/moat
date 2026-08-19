export type IdMigrationJournal = {
  userId: string;
  newUserId: string;
  startedAt: string;
  idMap: Record<string, Record<string, string>>;
  groupIdMap: Record<string, string>;
  storesWritten: string[];
};

export interface IdMigrationJournalStore {
  read(): IdMigrationJournal | null;
  write(journal: IdMigrationJournal): void;
  clear(): void;
}

const JOURNAL_KEY = "moat.id-migration-journal";

function isJournal(value: unknown): value is IdMigrationJournal {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<IdMigrationJournal>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.newUserId === "string" &&
    typeof candidate.startedAt === "string" &&
    typeof candidate.idMap === "object" &&
    candidate.idMap !== null &&
    typeof candidate.groupIdMap === "object" &&
    candidate.groupIdMap !== null &&
    Array.isArray(candidate.storesWritten)
  );
}

export function createMemoryJournalStore(
  initial: IdMigrationJournal | null = null,
): IdMigrationJournalStore {
  let journal = initial;
  return {
    read: () => journal,
    write: (next) => {
      journal = structuredClone(next);
    },
    clear: () => {
      journal = null;
    },
  };
}

export function createLocalStorageJournalStore(): IdMigrationJournalStore {
  return {
    read() {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(JOURNAL_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        return isJournal(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    write(journal) {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      } catch {
        throw new Error(
          "Could not record migration progress on this device, so the migration was not started.",
        );
      }
    },
    clear() {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(JOURNAL_KEY);
      } catch {
        // A journal left behind just makes the next run resume. That is safe.
      }
    },
  };
}
