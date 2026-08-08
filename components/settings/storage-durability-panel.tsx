"use client";

import { useEffect, useState } from "react";

import {
  isStoragePersisted,
  requestPersistentStorage,
  type PersistentStorageResult,
} from "@/lib/pwa/persistent-storage";
import { Button } from "@/components/ui/button";

const copy: Record<PersistentStorageResult, { label: string; detail: string }> = {
  persisted: {
    label: "Protected",
    detail:
      "This browser has agreed not to clear your records to free up space. Keep taking backups anyway, because a deleted app still takes its data with it.",
  },
  denied: {
    label: "Not protected",
    detail:
      "This browser can clear your records when the device runs low on space. Safari usually grants protection once you add Moat to your Home Screen and use it a few times.",
  },
  unsupported: {
    label: "Unknown",
    detail:
      "This browser cannot say whether your records are protected. Treat backups as your only guarantee.",
  },
};

/**
 * Shows whether the browser has agreed to keep our data.
 *
 * Moat stores every record on the device, so eviction is data loss rather than
 * a slow reload. The request itself runs at launch; this panel reports the
 * answer and lets a person ask again after installing to the Home Screen.
 */
export function StorageDurabilityPanel() {
  const [state, setState] = useState<PersistentStorageResult | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    void isStoragePersisted().then(setState);
  }, []);

  async function askAgain() {
    setIsAsking(true);
    try {
      setState(await requestPersistentStorage());
    } finally {
      setIsAsking(false);
    }
  }

  if (state === null) {
    return <p className="text-sm text-muted-foreground">Checking storage...</p>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm">
        <span className="font-medium">Device storage: {copy[state].label}</span>
      </p>
      <p className="text-xs text-muted-foreground">{copy[state].detail}</p>
      {state === "denied" ? (
        <Button
          size="sm"
          variant="outline"
          className="justify-self-start"
          disabled={isAsking}
          onClick={() => void askAgain()}
        >
          {isAsking ? "Asking..." : "Ask again"}
        </Button>
      ) : null}
    </div>
  );
}
