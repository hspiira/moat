/**
 * Build-time feature flags. These read `NEXT_PUBLIC_*` env vars, which Next
 * inlines at build time, so they evaluate identically on the server and the
 * client (no hydration mismatch).
 */

/**
 * Hosted (cloud) sync. Off by default: there is no Moat-hosted multi-tenant
 * backend yet, so the sync UI (endpoint, token, "Sync now", conflicts) is
 * hidden to avoid promising something the product can't deliver. The offline
 * outbox plumbing stays in place, ready for when a backend ships. Set
 * `NEXT_PUBLIC_ENABLE_HOSTED_SYNC=true` to surface the controls.
 */
export function isHostedSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_HOSTED_SYNC === "true";
}
