import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { UserProfile } from "@/lib/types";

type FullExport = {
  exportedAt: string;
  schemaVersion: number;
  userProfile: UserProfile | null;
  accounts: unknown[];
  transactions: unknown[];
  categories: unknown[];
  goals: unknown[];
  budgets: unknown[];
  investmentProfiles: unknown[];
  imports: unknown[];
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

  let investmentProfiles: unknown[] = [];
  if (userId) {
    const profile = await repositories.investmentProfiles.getByUser(userId);
    if (profile) {
      investmentProfiles = [profile];
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 2,
    userProfile,
    accounts,
    transactions,
    categories,
    goals,
    budgets,
    investmentProfiles,
    imports,
  };
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
