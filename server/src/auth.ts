import { bearerTokenFrom, type SyncPrincipal } from "@/lib/sync/server-contract";

import { resolveSyncCredential } from "./db/credentials.js";

export async function authenticateSyncRequest(
  authorization: string | undefined,
): Promise<SyncPrincipal> {
  const token = bearerTokenFrom(authorization ?? null);
  const userId = await resolveSyncCredential(token);

  if (!userId) {
    throw new Error("Hosted sync bearer token is not recognised.");
  }

  return { userId };
}
