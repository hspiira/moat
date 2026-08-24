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

/** The address to sync with: what the device stored, else what the build knows. */
export function resolveSyncEndpoint(
  stored?: string,
  env: Record<string, string | undefined> = BUILD_ENV,
): string {
  return stored?.trim() || configuredSyncEndpoint(env);
}

/** Whether to ask for the address, which is only when the build has no answer. */
export function needsManualSyncEndpoint(
  env: Record<string, string | undefined> = BUILD_ENV,
): boolean {
  return configuredSyncEndpoint(env) === "";
}
