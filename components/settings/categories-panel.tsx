"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { countCategoryUsage } from "@/lib/domain/category-usage";
import {
  categoryKindLabels,
  categoryKindOrder,
} from "@/lib/domain/transaction-classification";
import { errorMessage } from "@/lib/errors";
import { repositories } from "@/lib/repositories/instance";
import type { Category } from "@/lib/types";

/**
 * Hides categories a user never uses.
 *
 * The app seeds 21 categories, and most people use about five. A category is
 * never deleted: a transaction stores a categoryId, so removing one would break
 * every past transaction that used it. Hiding keeps the history readable and
 * takes the category out of the picker.
 */
export function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await repositories.userProfile.get();
        if (!profile) return;
        const [storedCategories, storedTransactions] = await Promise.all([
          repositories.categories.listByUser(profile.id),
          repositories.transactions.listByUser(profile.id),
        ]);
        setCategories(storedCategories);
        setUsage(countCategoryUsage(storedTransactions));
      } catch (loadError) {
        setError(errorMessage(loadError, "Couldn't load categories."));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const groups = useMemo(
    () =>
      categoryKindOrder
        .map((kind) => ({
          kind,
          label: categoryKindLabels[kind],
          entries: categories
            .filter((category) => category.kind === kind)
            .slice()
            .sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .filter((group) => group.entries.length > 0),
    [categories],
  );

  async function toggle(category: Category) {
    setBusyId(category.id);
    setError(null);
    try {
      const next = { ...category, isArchived: !category.isArchived };
      await repositories.categories.upsert(next);
      setCategories((current) =>
        current.map((entry) => (entry.id === category.id ? next : entry)),
      );
    } catch (saveError) {
      setError(errorMessage(saveError, "Couldn't change that category."));
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading categories...</p>;
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {groups.map((group) => (
        <div key={group.kind} className="grid gap-1">
          <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {group.label}
          </h3>
          <ul className="grid">
            {group.entries.map((category) => {
              const used = usage.get(category.id) ?? 0;
              return (
                <li
                  key={category.id}
                  className="flex min-w-0 items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className={category.isArchived ? "text-muted-foreground" : ""}>
                      {category.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {category.isArchived ? " · hidden" : ""}
                      {used > 0 ? ` · used ${used}` : ""}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={busyId === category.id}
                    onClick={() => void toggle(category)}
                  >
                    {category.isArchived ? "Show" : "Hide"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Hiding a category takes it out of the picker. Past transactions keep it, and it
        comes back on its own if a transaction still uses it.
      </p>
    </div>
  );
}
