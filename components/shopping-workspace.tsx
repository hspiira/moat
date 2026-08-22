"use client";

import { useMemo, useState } from "react";

import type { PlannedPurchase } from "@/lib/types";

import { FeaturePageShell } from "@/components/feature-page-shell";
import { IconPlus } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { FormCardShell } from "@/components/forms/form-card-shell";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AgainstBudgetNote } from "@/components/shopping/against-budget-note";
import { estimateBasis } from "@/components/shopping/estimate-basis";
import { Money } from "@/components/ui/money";

import { CheckOffSheet } from "./shopping/check-off-sheet";
import { PlannerEditSheet } from "./shopping/planner-edit-sheet";
import { ItemHistorySheet } from "./shopping/item-history-sheet";
import { PlannerAddForm } from "./shopping/planner-add-form";
import { PlannerList } from "./shopping/planner-list";
import { useShoppingWorkspace } from "./shopping/use-shopping-workspace";

export function ShoppingWorkspace() {
  const workspace = useShoppingWorkspace();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [isCheckOffOpen, setIsCheckOffOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PlannedPurchase | null>(null);

  const itemsById = useMemo(
    () => new Map(workspace.items.map((item) => [item.id, item])),
    [workspace.items],
  );
  const transactionsById = useMemo(
    () => new Map(workspace.transactions.map((entry) => [entry.id, entry])),
    [workspace.transactions],
  );
  const selectedPurchases = workspace.purchases.filter((purchase) =>
    selectedIds.has(purchase.id),
  );

  const toggleSelect = (purchase: { id: string }) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(purchase.id)) next.delete(purchase.id);
      else next.add(purchase.id);
      return next;
    });
  };

  return (
    <FeaturePageShell
      title="Shopping"
      srOnlyTitle
      description="Plan what to buy and remember what it cost last time."
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
      loadingMessage="Loading your shopping list..."
      setupMessage="Complete onboarding before planning purchases."
    >
      <div className="grid gap-6">
        {/* A headline of nought is not a headline. The empty state carries the
            page until there is something to add up. */}
        {workspace.estimate.total > 0 || workspace.estimate.unknownCount > 0 ? (
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">This trip will cost about</p>
          <div className="font-display text-[clamp(2.25rem,10vw,3rem)] leading-[1.1] font-semibold tracking-tight">
            <Money
              amount={workspace.estimate.total}
              tone="neutral"
              className="font-display"
            />
          </div>
          <p className="text-sm text-muted-foreground">{estimateBasis(workspace.estimate)}</p>
        </div>
        ) : null}

        <AgainstBudgetNote rows={workspace.againstBudget} />

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsAddOpen(true)} className="flex-1 sm:flex-none sm:px-6">
            <IconPlus className="size-4" /> Add an item
          </Button>
          {selectedPurchases.length > 0 ? (
            <Button
              variant="outline"
              disabled={workspace.isSubmitting}
              className="flex-1 sm:flex-none sm:px-6"
              onClick={() => setIsCheckOffOpen(true)}
            >
              Bought {selectedPurchases.length}
            </Button>
          ) : null}
        </div>

        <PlannerList
          groups={workspace.groups}
          itemsById={itemsById}
          priceSummaries={workspace.priceSummaries}
          selectedIds={selectedIds}
          transactionsById={transactionsById}
          isSubmitting={workspace.isSubmitting}
          onToggleSelect={toggleSelect}
          onDrop={(purchase) => void workspace.dropPurchase(purchase)}
          onEdit={(purchase) => setEditingPurchase(purchase)}
          onRestore={(purchase) => void workspace.restorePurchase(purchase)}
          onOpenHistory={(itemId) => setHistoryItemId(itemId)}
        />
      </div>
      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Add an item</SheetTitle>
            <SheetDescription>Name what you mean to buy.</SheetDescription>
          </SheetHeader>
          <FormCardShell
            embedded
            title="Add an item"
            description="Name it and it remembers what you last paid. Leave the price out and it uses that."
          >
            <PlannerAddForm
              items={workspace.items}
              lastPaidFor={workspace.lastPaidFor}
              isSubmitting={workspace.isSubmitting}
              onAdd={(input) => {
                void workspace.addPurchase(input);
                setIsAddOpen(false);
              }}
            />
          </FormCardShell>
        </SheetContent>
      </Sheet>

      <PlannerEditSheet
        purchase={editingPurchase}
        item={editingPurchase ? workspace.items.find((i) => i.id === editingPurchase.itemId) : undefined}
        isSubmitting={workspace.isSubmitting}
        onSave={(purchase, patch) => {
          void workspace.editPurchase(purchase, patch).then(() => setEditingPurchase(null));
        }}
        onOpenChange={(open) => (open ? undefined : setEditingPurchase(null))}
      />
      <CheckOffSheet
        open={isCheckOffOpen}
        selected={selectedPurchases}
        items={workspace.items}
        recentExpenses={workspace.recentExpenses}
        accounts={workspace.accounts}
        expenseCategories={workspace.expenseCategories}
        isSubmitting={workspace.isSubmitting}
        onConfirm={(target, actuals) => {
          void workspace.checkOff(selectedPurchases, target, actuals).then((succeeded) => {
            if (!succeeded) return;
            setSelectedIds(new Set());
            setIsCheckOffOpen(false);
          });
        }}
        onOpenChange={setIsCheckOffOpen}
      />
      <ItemHistorySheet
        item={historyItemId ? (itemsById.get(historyItemId) ?? null) : null}
        observations={workspace.observations.filter(
          (observation) => observation.itemId === historyItemId,
        )}
        summary={historyItemId ? workspace.priceSummaries.get(historyItemId) : undefined}
        onOpenChange={(open) => (open ? undefined : setHistoryItemId(null))}
      />
    </FeaturePageShell>
  );
}
