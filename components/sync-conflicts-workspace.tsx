"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { repositories } from "@/lib/repositories/instance";
import {
  listSyncConflicts,
  resolveSyncConflictKeepLocal,
  resolveSyncConflictUseServer,
  type SyncConflictRecord,
} from "@/lib/sync/conflicts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-shell/page-header";

function formatValue(value: unknown) {
  if (value == null) {
    return "Unavailable";
  }

  return JSON.stringify(value, null, 2);
}

export function SyncConflictsWorkspace() {
  const [userId, setUserId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflictRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadConflicts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const profile = await repositories.userProfile.get();
      if (!profile) {
        setUserId(null);
        setConflicts([]);
        return;
      }

      setUserId(profile.id);
      setConflicts(await listSyncConflicts(profile.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load sync conflicts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConflicts();
  }, [loadConflicts]);

  const groupedConflicts = useMemo(() => {
    return conflicts.reduce<Record<string, SyncConflictRecord[]>>((groups, conflict) => {
      groups[conflict.item.entityType] ??= [];
      groups[conflict.item.entityType].push(conflict);
      return groups;
    }, {});
  }, [conflicts]);

  async function handleKeepLocal(outboxId: string) {
    setWorkingId(outboxId);
    setError(null);
    setSuccess(null);

    try {
      await resolveSyncConflictKeepLocal(outboxId);
      setSuccess("Local version queued again. Run sync when you are ready.");
      await loadConflicts();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Unable to keep the local version.");
    } finally {
      setWorkingId(null);
    }
  }

  async function handleUseServer(outboxId: string) {
    setWorkingId(outboxId);
    setError(null);
    setSuccess(null);

    try {
      await resolveSyncConflictUseServer(outboxId);
      setSuccess("Server version applied locally and the conflict was cleared.");
      await loadConflicts();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Unable to apply the server version.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sync conflicts"
        description="Review ledger-affecting records that need a final choice before hosted sync can continue cleanly."
        aside={
          <Button asChild variant="outline">
            <Link href="/settings">Back to settings</Link>
          </Button>
        }
      />

      {success ? <div className="text-sm text-muted-foreground">{success}</div> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {!userId && !isLoading ? (
        <Card className="border-border/30 shadow-none">
          <CardContent className="p-5 text-sm text-muted-foreground">
            Finish onboarding before reviewing hosted sync conflicts.
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/30 shadow-none">
          <CardContent className="p-5 text-sm text-muted-foreground">
            Loading sync conflicts...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && userId && conflicts.length === 0 ? (
        <Card className="border-border/30 shadow-none">
          <CardContent className="p-5 text-sm text-muted-foreground">
            No hosted sync conflicts need review right now.
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && userId
        ? Object.entries(groupedConflicts).map(([entityType, items]) => (
            <section key={entityType} className="grid gap-4">
              <div className="text-sm font-medium text-foreground">
                {entityType} · {items.length}
              </div>
              {items.map((conflict) => (
                <Card key={conflict.item.id} className="border-border/30 shadow-none">
                  <CardHeader className="gap-2 pb-3">
                    <CardTitle className="text-base">
                      {conflict.item.entityType}:{conflict.item.entityId}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      Strategy: {conflict.strategy.replaceAll("_", " ")} · Operation: {conflict.item.operation}
                    </div>
                    {conflict.item.lastError ? (
                      <div className="text-xs text-destructive">{conflict.item.lastError}</div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="grid gap-2">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Local pending version
                        </div>
                        <pre className="overflow-x-auto rounded-md border border-border/30 bg-muted/20 p-3 text-xs leading-relaxed text-foreground">
                          {formatValue(conflict.localPayload)}
                        </pre>
                      </div>
                      <div className="grid gap-2">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Server version
                        </div>
                        <pre className="overflow-x-auto rounded-md border border-border/30 bg-muted/20 p-3 text-xs leading-relaxed text-foreground">
                          {formatValue(
                            conflict.serverRecord
                              ? {
                                  ...conflict.serverRecord,
                                  payload: conflict.serverRecord.payload
                                    ? JSON.parse(conflict.serverRecord.payload)
                                    : null,
                                }
                              : null,
                          )}
                        </pre>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={workingId === conflict.item.id}
                        onClick={() => void handleKeepLocal(conflict.item.id)}
                      >
                        {workingId === conflict.item.id ? "Working..." : "Keep local version"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={workingId === conflict.item.id || !conflict.serverRecord}
                        onClick={() => void handleUseServer(conflict.item.id)}
                      >
                        Use server version
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          ))
        : null}
    </div>
  );
}

