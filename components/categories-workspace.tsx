"use client";

import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";

import { CategoryDetailSheet } from "@/components/categories/category-detail-sheet";
import { CategorySection } from "@/components/categories/category-section";
import { DuplicatesCard } from "@/components/categories/duplicates-card";
import {
  categoryFilterLabels,
  useCategoriesWorkspace,
  type CategoryFilter,
} from "@/components/categories/use-categories-workspace";
import { PageHeader } from "@/components/page-shell/page-header";
import { ErrorNotice, LoadingStateCard } from "@/components/page-shell/page-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { CategoryUse } from "@/lib/domain/category-overview";
import type { CategoryKind } from "@/lib/types";

const filters: CategoryFilter[] = ["all", "used", "unused", "hidden"];

export function CategoriesWorkspace() {
  const workspace = useCategoriesWorkspace();
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingKind, setAddingKind] = useState<CategoryKind | null>(null);
  const [draftName, setDraftName] = useState("");

  const openUse: CategoryUse | null =
    workspace.allUses.find((use) => use.category.id === openId) ?? null;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Categories"
        description="Where every transaction gets filed. Rename one, fold a duplicate into another, or clear out what you never use."
      />

      {workspace.error ? <ErrorNotice message={workspace.error} /> : null}
      {workspace.notice ? (
        <p className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {workspace.notice}
        </p>
      ) : null}

      {workspace.isLoading ? <LoadingStateCard message="Loading categories..." /> : null}

      {!workspace.isLoading ? (
        <>
          {workspace.duplicates.length > 0 ? (
            <DuplicatesCard
              duplicates={workspace.duplicates}
              isBusy={workspace.busyId !== null}
              onMerge={() => void workspace.mergeDuplicates()}
            />
          ) : null}

          <div className="grid gap-2">
            <div className="relative">
              <IconSearch
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={workspace.query}
                onChange={(event) => workspace.setQuery(event.target.value)}
                placeholder="Search categories"
                className="h-10 pl-9"
                aria-label="Search categories"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {filters.map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={workspace.filter === filter ? "default" : "outline"}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => workspace.setFilter(filter)}
                >
                  {categoryFilterLabels[filter]}
                  {filter === "unused" && workspace.counts.unused > 0
                    ? ` (${workspace.counts.unused})`
                    : ""}
                  {filter === "hidden" && workspace.counts.hidden > 0
                    ? ` (${workspace.counts.hidden})`
                    : ""}
                </Button>
              ))}

              {workspace.counts.unused > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 px-2 text-xs"
                  disabled={workspace.busyId !== null}
                  onClick={() => void workspace.hideUnused()}
                >
                  Hide the {workspace.counts.unused} unused
                </Button>
              ) : null}
            </div>
          </div>

          {workspace.groups.length === 0 ? (
            <EmptyState>
              {workspace.query
                ? `Nothing matches "${workspace.query}".`
                : "No categories to show under this filter."}
            </EmptyState>
          ) : (
            <div className="grid gap-5">
              {workspace.groups.map((group) => (
                <CategorySection
                  key={group.kind}
                  group={group}
                  isAdding={addingKind === group.kind}
                  draftName={draftName}
                  isBusy={workspace.busyId !== null}
                  onDraftChange={setDraftName}
                  onStartAdd={(kind) => {
                    setAddingKind(kind);
                    setDraftName("");
                  }}
                  onAdd={(kind) => {
                    setAddingKind(null);
                    void workspace.addCategory(draftName, kind);
                    setDraftName("");
                  }}
                  onOpen={(use) => setOpenId(use.category.id)}
                />
              ))}
            </div>
          )}

          <p className="text-xs leading-5 text-muted-foreground">
            Hiding takes a category out of the picker without touching past transactions. The
            ones Moat ships with can be hidden but not deleted, because they come back on the
            next load.
          </p>
        </>
      ) : null}

      <CategoryDetailSheet
        key={openId}
        use={openUse}
        categories={workspace.categories}
        isBusy={workspace.busyId !== null}
        canDelete={openUse ? workspace.canDelete(openUse.category) : false}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        onRename={(category, name) => void workspace.renameCategory(category, name)}
        onToggleHidden={(category, hidden) => void workspace.setHidden(category, hidden)}
        onMoveInto={(category, targetId) => {
          setOpenId(null);
          void workspace.moveInto(category, targetId);
        }}
        onDelete={(category) => {
          setOpenId(null);
          void workspace.deleteCategory(category);
        }}
      />
    </div>
  );
}
