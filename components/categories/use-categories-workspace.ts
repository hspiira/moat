"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  categoryMatchKey,
  findCategoryByName,
  findDuplicateCategories,
  planCategoryMerge,
  planCategoryMoveInto,
} from "@/lib/domain/category-merge";
import { buildCategoryOverview, type CategoryGroup } from "@/lib/domain/category-overview";
import { countCategoryUsage } from "@/lib/domain/category-usage";
import { createId } from "@/lib/ids";
import { errorMessage } from "@/lib/errors";
import {
  applyCategoryMerge,
  loadCategoryReferenceCounts,
  type CategoryReferenceCounts,
} from "@/lib/repositories/category-references";
import { repositories } from "@/lib/repositories/instance";
import type { Category, CategoryKind, Transaction } from "@/lib/types";

export type CategoryFilter = "all" | "used" | "unused" | "hidden";

export const categoryFilterLabels: Record<CategoryFilter, string> = {
  all: "All",
  used: "In use",
  unused: "Never used",
  hidden: "Hidden",
};

export function useCategoriesWorkspace() {
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [references, setReferences] = useState<CategoryReferenceCounts>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const reload = useCallback(async (id: string) => {
    const [storedCategories, storedTransactions, referenceCounts] = await Promise.all([
      repositories.categories.listByUser(id),
      repositories.transactions.listByUser(id),
      loadCategoryReferenceCounts(id),
    ]);
    setCategories(storedCategories);
    setTransactions(storedTransactions);
    setReferences(referenceCounts);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await repositories.userProfile.get();
        if (!profile) return;
        setUserId(profile.id);
        await reload(profile.id);
      } catch (loadError) {
        setError(errorMessage(loadError, "Couldn't load categories."));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [reload]);

  const usage = useMemo(() => countCategoryUsage(transactions), [transactions]);

  const duplicates = useMemo(
    () => findDuplicateCategories(categories, usage),
    [categories, usage],
  );

  const overview = useMemo(
    () => buildCategoryOverview(categories, transactions),
    [categories, transactions],
  );

  const allUses = useMemo(() => overview.flatMap((group) => group.uses), [overview]);

  const groups: CategoryGroup[] = useMemo(() => {
    const search = categoryMatchKey(query);

    return overview
      .map((group) => ({
        kind: group.kind,
        uses: group.uses.filter((use) => {
          if (search && !categoryMatchKey(use.category.name).includes(search)) return false;
          if (filter === "hidden") return use.category.isArchived === true;
          if (use.category.isArchived) return false;
          if (filter === "used") return use.count > 0;
          if (filter === "unused") return use.count === 0;
          return true;
        }),
      }))
      .filter((group) => group.uses.length > 0);
  }, [filter, overview, query]);

  const counts = useMemo(() => {
    const visible = categories.filter((category) => !category.isArchived);
    return {
      unused: visible.filter((category) => (usage.get(category.id) ?? 0) === 0).length,
      hidden: categories.length - visible.length,
    };
  }, [categories, usage]);

  const canDelete = useCallback(
    (category: Category) => !category.isDefault && (references.get(category.id) ?? 0) === 0,
    [references],
  );

  const run = useCallback(
    async (id: string, message: string, work: () => Promise<string | null>) => {
      if (!userId) return;
      setBusyId(id);
      setError(null);
      setNotice(null);
      try {
        const result = await work();
        await reload(userId);
        setNotice(result ?? message);
      } catch (actionError) {
        setError(errorMessage(actionError, "Couldn't save that change."));
      } finally {
        setBusyId(null);
      }
    },
    [reload, userId],
  );

  const addCategory = useCallback(
    async (name: string, kind: CategoryKind) => {
      const trimmed = name.trim();
      if (!trimmed || !userId) return;

      const existing = findCategoryByName(categories, trimmed, kind);
      if (existing && !existing.isArchived) {
        setNotice(`${existing.name} is already on the list.`);
        return;
      }

      await run(existing?.id ?? "new", `Added ${trimmed}.`, async () => {
        if (existing) {
          await repositories.categories.upsert({ ...existing, isArchived: false });
          return `${existing.name} is back on the list.`;
        }
        await repositories.categories.upsert({
          id: createId(),
          userId,
          name: trimmed,
          kind,
          isDefault: false,
          createdAt: new Date().toISOString(),
        });
        return `Added ${trimmed}.`;
      });
    },
    [categories, run, userId],
  );

  const renameCategory = useCallback(
    async (category: Category, name: string) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === category.name) return;

      const clash = findCategoryByName(categories, trimmed, category.kind);
      if (clash && clash.id !== category.id) {
        setError(`${clash.name} already exists. Move this one into it instead.`);
        return;
      }

      await run(category.id, `Renamed to ${trimmed}.`, async () => {
        await repositories.categories.upsert({ ...category, name: trimmed });
        return `Renamed to ${trimmed}.`;
      });
    },
    [categories, run],
  );

  const setHidden = useCallback(
    async (category: Category, hidden: boolean) =>
      run(category.id, hidden ? `Hid ${category.name}.` : `${category.name} is back.`, async () => {
        await repositories.categories.upsert({ ...category, isArchived: hidden });
        return hidden ? `Hid ${category.name}.` : `${category.name} is back.`;
      }),
    [run],
  );

  const hideUnused = useCallback(async () => {
    const unused = categories.filter(
      (category) => !category.isArchived && (usage.get(category.id) ?? 0) === 0,
    );
    if (unused.length === 0) return;

    await run("bulk", `Hid ${unused.length} unused categories.`, async () => {
      await Promise.all(
        unused.map((category) => repositories.categories.upsert({ ...category, isArchived: true })),
      );
      return `Hid ${unused.length} categor${unused.length === 1 ? "y" : "ies"} nothing was filed under.`;
    });
  }, [categories, run, usage]);

  const deleteCategory = useCallback(
    async (category: Category) => {
      if (!canDelete(category)) return;
      await run(category.id, `Deleted ${category.name}.`, async () => {
        await repositories.categories.remove(category.id);
        return `Deleted ${category.name}.`;
      });
    },
    [canDelete, run],
  );

  const moveInto = useCallback(
    async (source: Category, targetId: string) => {
      const target = categories.find((category) => category.id === targetId);
      if (!target || target.id === source.id || !userId) return;

      const moved = usage.get(source.id) ?? 0;
      await run(source.id, `Moved into ${target.name}.`, async () => {
        await applyCategoryMerge({
          userId,
          plan: {
            ...planCategoryMoveInto([source.id], target.id),
            removedIds: source.isDefault ? [] : [source.id],
          },
          timestamp: new Date().toISOString(),
        });
        if (source.isDefault) {
          await repositories.categories.upsert({ ...source, isArchived: true });
          return `Moved ${moved} transaction${moved === 1 ? "" : "s"} into ${target.name} and hid ${source.name}, which is part of the starter set.`;
        }
        return `Moved ${moved} transaction${moved === 1 ? "" : "s"} into ${target.name} and deleted ${source.name}.`;
      });
    },
    [categories, run, usage, userId],
  );

  const mergeDuplicates = useCallback(async () => {
    if (!userId) return;
    const plan = planCategoryMerge(categories, usage);
    if (plan.removedIds.length === 0) return;

    await run("duplicates", "Merged the duplicates.", async () => {
      await applyCategoryMerge({ userId, plan, timestamp: new Date().toISOString() });
      return `Merged ${plan.removedIds.length} duplicate${plan.removedIds.length === 1 ? "" : "s"} into the copy already in use.`;
    });
  }, [categories, run, usage, userId]);

  return {
    categories,
    groups,
    allUses,
    duplicates,
    counts,
    isLoading,
    busyId,
    error,
    notice,
    query,
    filter,
    setQuery,
    setFilter,
    dismissNotice: () => setNotice(null),
    canDelete,
    addCategory,
    renameCategory,
    setHidden,
    hideUnused,
    deleteCategory,
    moveInto,
    mergeDuplicates,
  };
}
