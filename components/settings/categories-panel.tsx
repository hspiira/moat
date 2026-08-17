"use client";

import { useEffect, useMemo, useState } from "react";
import { IconPencil, IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { buildCategoryOverview, type CategoryUse } from "@/lib/domain/category-overview";
import { categoryKindLabels } from "@/lib/domain/transaction-classification";
import { createId } from "@/lib/ids";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format-date";
import { repositories } from "@/lib/repositories/instance";
import type { Category, CategoryKind } from "@/lib/types";

/**
 * What each category has actually cost, and the three things you can do about
 * it: rename, hide, add a new one.
 *
 * A category is never deleted. A transaction stores a categoryId, so removing
 * one would leave history pointing at nothing. Hiding takes it out of the
 * picker and leaves the past intact.
 */
export function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Parameters<typeof buildCategoryOverview>[1]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [newKind, setNewKind] = useState<CategoryKind | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const profile = await repositories.userProfile.get();
        if (!profile) return;
        setUserId(profile.id);
        const [storedCategories, storedTransactions] = await Promise.all([
          repositories.categories.listByUser(profile.id),
          repositories.transactions.listByUser(profile.id),
        ]);
        setCategories(storedCategories);
        setTransactions(storedTransactions);
      } catch (loadError) {
        setError(errorMessage(loadError, "Couldn't load categories."));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const groups = useMemo(
    () => buildCategoryOverview(categories, transactions),
    [categories, transactions],
  );

  const hiddenCount = categories.filter((category) => category.isArchived).length;

  async function persist(next: Category) {
    setBusyId(next.id);
    setError(null);
    try {
      await repositories.categories.upsert(next);
      setCategories((current) => {
        const exists = current.some((entry) => entry.id === next.id);
        return exists
          ? current.map((entry) => (entry.id === next.id ? next : entry))
          : [...current, next];
      });
    } catch (saveError) {
      setError(errorMessage(saveError, "Couldn't save that category."));
    } finally {
      setBusyId(null);
    }
  }

  async function commitRename(category: Category) {
    const name = draftName.trim();
    setEditingId(null);
    if (!name || name === category.name) return;
    await persist({ ...category, name });
  }

  async function addCategory(kind: CategoryKind) {
    const name = newName.trim();
    if (!name || !userId) return;
    setNewKind(null);
    setNewName("");
    await persist({
      id: createId(),
      userId,
      name,
      kind,
      isDefault: false,
      createdAt: new Date().toISOString(),
    });
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading categories...</p>;
  }

  return (
    <div className="grid gap-5">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {groups.map((group) => {
        const visible = group.uses.filter(
          (use) => showHidden || !use.category.isArchived,
        );
        if (visible.length === 0) return null;

        return (
          <section key={group.kind} className="grid min-w-0 gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {categoryKindLabels[group.kind]}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => {
                  setNewKind(group.kind);
                  setNewName("");
                }}
              >
                <IconPlus className="size-3.5" /> Add
              </Button>
            </div>

            {newKind === group.kind ? (
              <form
                className="flex gap-2 pb-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addCategory(group.kind);
                }}
              >
                <Input
                  autoFocus
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder={`New ${categoryKindLabels[group.kind].toLowerCase()} category`}
                  className="h-9 text-sm"
                />
                <Button type="submit" size="sm" disabled={!newName.trim()}>
                  Add
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewKind(null)}>
                  Cancel
                </Button>
              </form>
            ) : null}

            <ul className="grid min-w-0">
              {visible.map((use) => (
                <CategoryRow
                  key={use.category.id}
                  use={use}
                  isBusy={busyId === use.category.id}
                  isEditing={editingId === use.category.id}
                  draftName={draftName}
                  onDraftChange={setDraftName}
                  onStartRename={() => {
                    setEditingId(use.category.id);
                    setDraftName(use.category.name);
                  }}
                  onCommitRename={() => void commitRename(use.category)}
                  onToggleHidden={() =>
                    void persist({ ...use.category, isArchived: !use.category.isArchived })
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}

      {hiddenCount > 0 ? (
        <Button
          size="sm"
          variant="ghost"
          className="justify-self-start px-0 text-xs"
          onClick={() => setShowHidden((current) => !current)}
        >
          {showHidden ? "Hide hidden categories" : `Show ${hiddenCount} hidden`}
        </Button>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Hiding takes a category out of the picker. Past transactions keep it, and it comes
        back on its own if a transaction still uses it.
      </p>
    </div>
  );
}

function CategoryRow({
  use,
  isBusy,
  isEditing,
  draftName,
  onDraftChange,
  onStartRename,
  onCommitRename,
  onToggleHidden,
}: {
  use: CategoryUse;
  isBusy: boolean;
  isEditing: boolean;
  draftName: string;
  onDraftChange: (value: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onToggleHidden: () => void;
}) {
  const { category, count, total, lastUsedOn } = use;

  if (isEditing) {
    return (
      <li className="border-b border-border/40 py-1.5 last:border-b-0">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onCommitRename();
          }}
        >
          <Input
            autoFocus
            value={draftName}
            onChange={(event) => onDraftChange(event.target.value)}
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" disabled={isBusy}>
            Save
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex min-w-0 items-center gap-2 border-b border-border/40 py-2 last:border-b-0">
      <button
        type="button"
        onClick={onStartRename}
        className="grid min-w-0 flex-1 gap-0.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Rename ${category.name}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={`truncate text-sm ${category.isArchived ? "text-muted-foreground" : "text-foreground"}`}
          >
            {category.name}
          </span>
          <IconPencil aria-hidden className="size-3 shrink-0 text-muted-foreground" />
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {count === 0
            ? "Never used"
            : `${count} ${count === 1 ? "transaction" : "transactions"}${lastUsedOn ? ` · last ${formatDate(lastUsedOn)}` : ""}`}
          {category.isArchived ? " · hidden" : ""}
        </span>
      </button>

      {total > 0 ? (
        <Money amount={total} currency="UGX" className="shrink-0 text-sm tabular-nums" />
      ) : null}

      <Button
        size="sm"
        variant="ghost"
        className="shrink-0 text-xs"
        disabled={isBusy}
        onClick={onToggleHidden}
      >
        {category.isArchived ? "Show" : "Hide"}
      </Button>
    </li>
  );
}
