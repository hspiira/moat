"use client";

import { useEffect, useState } from "react";

import { createIndexedDbRepositories } from "@/lib/repositories/indexeddb";
import type { CorrectionLog, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const repositories = createIndexedDbRepositories();

export function CorrectionLogPanel({ profile }: { profile: UserProfile | null }) {
  const [logs, setLogs] = useState<CorrectionLog[]>([]);

  useEffect(() => {
    async function loadLogs() {
      if (!profile) {
        setLogs([]);
        return;
      }

      const stored = await repositories.correctionLogs.listByUser(profile.id);
      setLogs(stored.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8));
    }

    void loadLogs();
  }, [profile]);

  return (
    <Card className="gap-0 border-border/20 pt-0 shadow-none">
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-1">
          <div className="text-sm text-foreground">Correction log</div>
          <div className="text-sm text-muted-foreground">
            Approved capture edits are logged here for parser refinement, not auto-learning.
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState className="py-6">No capture corrections have been logged yet.</EmptyState>
        ) : (
          <div className="grid gap-2">
            {logs.map((log) => (
              <div key={log.id} className="grid gap-1 border border-border/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground">{log.parserLabel ?? "generic parser"}</span>
                  <span className="text-muted-foreground">{log.createdAt.slice(0, 10)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {log.originalSnapshot.payee || "Unlabeled"} → {log.approvedSnapshot.payee || "Unlabeled"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {log.originalSnapshot.type} / {log.originalSnapshot.categoryId} → {log.approvedSnapshot.type} /{" "}
                  {log.approvedSnapshot.categoryId}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
