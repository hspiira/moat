"use client";

import { useMemo, useState } from "react";

import { FeaturePageShell } from "@/components/feature-page-shell";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";

import { CheckOffSheet } from "./shopping/check-off-sheet";
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
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Estimated total <Money amount={workspace.estimate.total} tone="neutral" />
            {workspace.estimate.unestimatedCount > 0
              ? ` · ${workspace.estimate.unestimatedCount} unestimated`
              : ""}
          </p>
          <Button
            size="sm"
            disabled={selectedPurchases.length === 0 || workspace.isSubmitting}
            onClick={() => setIsCheckOffOpen(true)}
          >
            Bought {selectedPurchases.length > 0 ? `(${selectedPurchases.length})` : ""}
          </Button>
        </div>

        {/* The list is what you came for; the form is what you occasionally
            need. It opens on request rather than sitting above every visit. */}
        {isAddOpen ? (
          <div className="grid gap-2 rounded-lg border border-border/40 p-3">
            <PlannerAddForm
              items={workspace.items}
              isSubmitting={workspace.isSubmitting}
              onAdd={(input) => {
                void workspace.addPurchase(input);
                setIsAddOpen(false);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="justify-self-start"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            onClick={() => setIsAddOpen(true)}
          >
            Add an item
          </Button>
        )}

        <PlannerList
          groups={workspace.groups}
          itemsById={itemsById}
          priceSummaries={workspace.priceSummaries}
          selectedIds={selectedIds}
          transactionsById={transactionsById}
          isSubmitting={workspace.isSubmitting}
          onToggleSelect={toggleSelect}
          onDrop={(purchase) => void workspace.dropPurchase(purchase)}
          onRestore={(purchase) => void workspace.restorePurchase(purchase)}
          onOpenHistory={(itemId) => setHistoryItemId(itemId)}
        />
      </div>
      <CheckOffSheet
        open={isCheckOffOpen}
        selected={selectedPurchases}
        recentExpenses={workspace.recentExpenses}
        accounts={workspace.accounts}
        expenseCategories={workspace.expenseCategories}
        isSubmitting={workspace.isSubmitting}
        onConfirm={(target) => {
          void workspace.checkOff(selectedPurchases, target).then((succeeded) => {
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
