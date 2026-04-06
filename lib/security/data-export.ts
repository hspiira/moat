import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type {
  Account,
  BudgetTarget,
  Category,
  Goal,
  ImportBatch,
  InvestmentProfile,
  Transaction,
  UserProfile,
} from "@/lib/types";

export type FullExport = {
  exportedAt: string;
  schemaVersion: number;
  userProfile: UserProfile | null;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  budgets: BudgetTarget[];
  investmentProfiles: InvestmentProfile[];
  imports: ImportBatch[];
};

/**
 * Collect all user data from IndexedDB and return as a structured export object.
 */
export async function collectFullExport(): Promise<FullExport> {
  const repositories = createIndexedDbRepositories();

  const userProfile = await repositories.userProfile.get();
  const userId = userProfile?.id ?? "";

  const [accounts, transactions, categories, goals, budgets, imports] = await Promise.all([
    userId ? repositories.accounts.listByUser(userId) : Promise.resolve([]),
    userId ? repositories.transactions.listByUser(userId) : Promise.resolve([]),
    userId ? repositories.categories.listByUser(userId) : Promise.resolve([]),
    userId ? repositories.goals.listByUser(userId) : Promise.resolve([]),
    userId ? repositories.budgets.listByUser(userId) : Promise.resolve([]),
    userId ? repositories.imports.listByUser(userId) : Promise.resolve([]),
  ]);

  const investmentProfile = userId
    ? await repositories.investmentProfiles.getByUser(userId)
    : null;

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 2,
    userProfile,
    accounts,
    transactions,
    categories,
    goals,
    budgets,
    investmentProfiles: investmentProfile ? [investmentProfile] : [],
    imports,
  };
}

/**
 * Restore a FullExport into IndexedDB, overwriting any existing records with the same id.
 */
export async function restoreFullExport(data: FullExport): Promise<void> {
  const repositories = createIndexedDbRepositories();

  if (data.userProfile) {
    await repositories.userProfile.save(data.userProfile);
  }

  await Promise.all([
    ...data.accounts.map((r) => repositories.accounts.upsert(r)),
    ...data.transactions.map((r) => repositories.transactions.upsert(r)),
    ...data.categories.map((r) => repositories.categories.upsert(r)),
    ...data.goals.map((r) => repositories.goals.upsert(r)),
    ...data.budgets.map((r) => repositories.budgets.upsert(r)),
    ...data.imports.map((r) => repositories.imports.upsert(r)),
    ...(data.investmentProfiles.length > 0
      ? [repositories.investmentProfiles.save(data.investmentProfiles[0])]
      : []),
  ]);
}

/**
 * Trigger a browser download of the export as a JSON file.
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of an encrypted backup blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

/**
 * Permanently delete all user data from IndexedDB.
 * This is destructive and cannot be undone.
 */
export async function deleteAllUserData(): Promise<void> {
  // Use the raw IndexedDB API to delete the entire database
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("uganda-finance-app");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to delete database."));
    request.onblocked = () => {
      // Another tab has the database open — resolve anyway, the delete will
      // complete when all connections close
      resolve();
    };
  });
}
