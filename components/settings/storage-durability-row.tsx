"use client";

import { useEffect, useState } from "react";

import {
  isEvictable,
  isRunningLowOnSpace,
  readStorageDurability,
  type StorageDurability,
} from "@/lib/storage-durability";

function formatBytes(bytes: number) {
  const mb = bytes / 1_048_576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

export function StorageDurabilityRow() {
  const [durability, setDurability] = useState<StorageDurability | null>(null);

  useEffect(() => {
    void readStorageDurability().then(setDurability);
  }, []);

  if (!durability) return null;

  const usage =
    durability.usedBytes !== null && durability.quotaBytes
      ? `${formatBytes(durability.usedBytes)} of ${formatBytes(durability.quotaBytes)} used.`
      : null;

  const state =
    durability.state === "persisted"
      ? "This device has promised to keep your records and will not clear them."
      : durability.state === "best-effort"
        ? "This device has not promised to keep your records, so it may clear them. Keep a backup."
        : "This device does not report whether it will keep your records. Keep a backup.";

  return (
    <p
      className={`text-xs ${
        isEvictable(durability) || isRunningLowOnSpace(durability)
          ? "text-foreground"
          : "text-muted-foreground"
      }`}
    >
      {state} {usage}
      {isRunningLowOnSpace(durability) ? " Storage is nearly full." : ""}
    </p>
  );
}
