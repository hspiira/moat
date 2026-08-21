import type { Page } from "@playwright/test";

import { storeNames } from "@/lib/repositories/store-names";

const BUNDLE_STORES: Record<string, string> = {
  userProfile: storeNames.userProfiles,
  accounts: storeNames.accounts,
  transactions: storeNames.transactions,
  categories: storeNames.categories,
  counterparties: storeNames.counterparties,
  goals: storeNames.goals,
  budgets: storeNames.budgets,
  investmentProfiles: storeNames.investmentProfiles,
  imports: storeNames.imports,
  syncProfiles: storeNames.syncProfiles,
  syncOutbox: storeNames.syncOutbox,
  transactionRules: storeNames.transactionRules,
  recurringObligations: storeNames.recurringObligations,
  monthCloses: storeNames.monthCloses,
  items: storeNames.items,
  plannedPurchases: storeNames.plannedPurchases,
  projects: storeNames.projects,
  transactionLineItems: storeNames.transactionLineItems,
  captureEnvelopes: storeNames.captureEnvelopes,
  captureReviewItems: storeNames.captureReviewItems,
  correctionLogs: storeNames.correctionLogs,
};

export async function seedIndexedDb(page: Page, bundle: Record<string, unknown>) {
  return page.evaluate(
    async ([data, storeMap]) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("moat-db");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const written: Record<string, number> = {};
      for (const [key, store] of Object.entries(storeMap as Record<string, string>)) {
        if (!db.objectStoreNames.contains(store)) continue;
        const value = (data as Record<string, unknown>)[key];
        const records = (Array.isArray(value) ? value : [value]).filter(Boolean);
        if (records.length === 0) continue;

        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          const target = tx.objectStore(store);
          target.clear();
          for (const record of records) target.put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        written[store] = records.length;
      }

      db.close();
      return written;
    },
    [bundle, BUNDLE_STORES] as const,
  );
}
