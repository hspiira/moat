// Written out in full because the bundler only substitutes NEXT_PUBLIC_ values
// it can see literally.
const BUILD_ENV: Record<string, string | undefined> = {
  NEXT_PUBLIC_SYNC_ENDPOINT: process.env.NEXT_PUBLIC_SYNC_ENDPOINT,
};

/** The sync address this build was given, if it was given one. */
export function configuredSyncEndpoint(
  env: Record<string, string | undefined> = BUILD_ENV,
): string {
  return env.NEXT_PUBLIC_SYNC_ENDPOINT?.trim() ?? "";
}

function currentOrigin(origin?: string): string {
  if (origin !== undefined) return origin.trim();
  return typeof window === "undefined" ? "" : window.location.origin;
}

/**
 * Where to reach the sync server: what this device stored, else what the build
 * was given, else the origin the app is served from. The deployment routes
 * /v1/sync here on the same domain, so that last fallback is the normal case
 * and nobody has to be asked.
 */
export function resolveSyncEndpoint(
  stored?: string,
  env: Record<string, string | undefined> = BUILD_ENV,
  origin?: string,
): string {
  return stored?.trim() || configuredSyncEndpoint(env) || currentOrigin(origin);
}

/** Whether to ask for the address, which is only when nothing else can answer. */
export function needsManualSyncEndpoint(
  env: Record<string, string | undefined> = BUILD_ENV,
  origin?: string,
): boolean {
  return configuredSyncEndpoint(env) === "" && currentOrigin(origin) === "";
}
