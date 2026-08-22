import { clearNativeStorage, hasNativeStorageBridge } from "@/lib/native/storage-bridge";
import {
  DATABASE_NAME,
  forgetFinanceDatabaseConnection,
  openFinanceDatabase,
} from "@/lib/repositories/indexeddb/client";

export async function clearRepositoryStorage(): Promise<void> {
  if (hasNativeStorageBridge()) {
    clearNativeStorage();
    return;
  }

  if (typeof indexedDB === "undefined") {
    throw new Error("No supported local storage backend is available.");
  }

  try {
    const database = await openFinanceDatabase();
    database.close();
  } catch {
  } finally {
    // The connection is shared, so closing it has to drop the cached handle or
    // the next read is handed a closed database.
    forgetFinanceDatabaseConnection();
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to delete database."));
    request.onblocked = () => resolve();
  });
}
