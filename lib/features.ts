export function isHostedSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_HOSTED_SYNC === "true";
}
