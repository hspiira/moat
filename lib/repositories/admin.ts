import { clearNativeStorage, hasNativeStorageBridge } from "@/lib/native/storage-bridge";
import { DATABASE_NAME, openFinanceDatabase } from "@/lib/repositories/indexeddb/client";

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
    // Continue with deletion even if the database has not been opened before.
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to delete database."));
    request.onblocked = () => resolve();
  });
}
