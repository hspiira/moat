"use client";

import { useEffect, useMemo, useState } from "react";

import { newestFirst } from "@/lib/domain/correction-log-pruning";
import { buildRuleFromCorrection, type RuleDraft } from "@/lib/domain/rule-from-correction";
import { repositories } from "@/lib/repositories/instance";
import type { Category, CorrectionLog, UserProfile } from "@/lib/types";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

function describeChange(
  log: CorrectionLog,
  nameOfCategory: (categoryId: string) => string,
): string[] {
  const changes: string[] = [];
  const readPayee = log.originalSnapshot.payee.trim() || "no payee";
  const fixedPayee = log.approvedSnapshot.payee.trim();

  if (fixedPayee && fixedPayee !== log.originalSnapshot.payee.trim()) {
    changes.push(`You renamed ${readPayee} to ${fixedPayee}.`);
  }

  if (log.approvedSnapshot.categoryId !== log.originalSnapshot.categoryId) {
    changes.push(
      `You moved it from ${nameOfCategory(log.originalSnapshot.categoryId)} to ${nameOfCategory(
        log.approvedSnapshot.categoryId,
      )}.`,
    );
  }

  if (log.approvedSnapshot.type !== log.originalSnapshot.type) {
    changes.push(`You changed it from ${log.originalSnapshot.type} to ${log.approvedSnapshot.type}.`);
  }

  return changes.length > 0 ? changes : ["You checked it and left it as read."];
}

export function CorrectionLogPanel({
  profile,
  categories,
  isSubmitting,
  onSaveRule,
}: {
  profile: UserProfile | null;
  categories: Category[];
  isSubmitting: boolean;
  onSaveRule: (rule: RuleDraft) => void;
}) {
  const [logs, setLogs] = useState<CorrectionLog[]>([]);

  const nameOfCategory = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category.name]));
    return (categoryId: string) => byId.get(categoryId) ?? "no category";
  }, [categories]);

  useEffect(() => {
    async function loadLogs() {
      if (!profile) {
        setLogs([]);
        return;
      }

      const stored = await repositories.correctionLogs.listByUser(profile.id);
      setLogs(newestFirst(stored).slice(0, 8));
    }

    void loadLogs();
  }, [profile]);

  return (
    <div className="grid content-start gap-3">
      <div className="grid gap-0.5">
        <h2 className="font-display text-base font-semibold">Corrections you have made</h2>
        <p className="text-xs leading-5 text-muted-foreground">
          Where a message was read wrongly and you fixed it. Turn a fix into a rule and it is
          fixed for you next time.
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState className="py-6">
          Nothing yet. This fills up as you correct transactions read from messages.
        </EmptyState>
      ) : (
        <div className="grid">
          {logs.map((log) => {
            const draft = buildRuleFromCorrection(log);
            return (
              <div key={log.id} className="grid gap-1.5 border-b border-border py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-foreground">
                    {log.parserLabel ?? "Read from a message"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </span>
                </div>
                {describeChange(log, nameOfCategory).map((change) => (
                  <p key={change} className="text-xs leading-5 text-muted-foreground">
                    {change}
                  </p>
                ))}
                {draft ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    className="-ml-2 h-7 justify-self-start text-xs"
                    onClick={() => onSaveRule(draft)}
                  >
                    Do this for me next time
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
