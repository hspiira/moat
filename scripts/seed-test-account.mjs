import { readFileSync } from "node:fs";

const DATABASE_NAME = "moat-db";

const BUNDLE_STORES = {
  userProfile: "userProfiles",
  accounts: "accounts",
  transactions: "transactions",
  categories: "categories",
  counterparties: "counterparties",
  goals: "goals",
  budgets: "budgets",
  investmentProfiles: "investmentProfiles",
  imports: "imports",
  syncProfiles: "syncProfiles",
  syncOutbox: "syncOutbox",
  transactionRules: "transactionRules",
  recurringObligations: "recurringObligations",
  monthCloses: "monthCloses",
  items: "items",
  plannedPurchases: "plannedPurchases",
  transactionLineItems: "transactionLineItems",
  captureEnvelopes: "captureEnvelopes",
  captureReviewItems: "captureReviewItems",
  correctionLogs: "correctionLogs",
};

export async function seedTestAccount(page, bundle) {
  return page.evaluate(
    async ([data, dbName, storeMap]) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const written = {};
      for (const [key, store] of Object.entries(storeMap)) {
        if (!db.objectStoreNames.contains(store)) continue;
        const records = [data[key]].flat().filter(Boolean);
        if (records.length === 0) continue;

        await new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          const target = tx.objectStore(store);
          target.clear();
          for (const record of records) target.put(record);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        written[store] = records.length;
      }

      db.close();
      return written;
    },
    [bundle, DATABASE_NAME, BUNDLE_STORES],
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, url = "http://localhost:3000"] = process.argv.slice(2);
  if (!file) {
    console.error("usage: node scripts/seed-test-account.mjs <export.json> [url]");
    process.exit(1);
  }

  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: process.env.CHROME });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  console.log(await seedTestAccount(page, JSON.parse(readFileSync(file, "utf8"))));
  await browser.close();
}
