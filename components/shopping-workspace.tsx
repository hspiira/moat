"use client";

import { useMemo, useState } from "react";

import { FeaturePageShell } from "@/components/feature-page-shell";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";

import { PlannerAddForm } from "./shopping/planner-add-form";
import { PlannerList } from "./shopping/planner-list";
import { useShoppingWorkspace } from "./shopping/use-shopping-workspace";

export function ShoppingWorkspace() {
  const workspace = useShoppingWorkspace();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [isCheckOffOpen, setIsCheckOffOpen] = useState(false);

  const itemsById = useMemo(
    () => new Map(workspace.items.map((item) => [item.id, item])),
    [workspace.items],
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

        <PlannerAddForm
          items={workspace.items}
          isSubmitting={workspace.isSubmitting}
          onAdd={(input) => void workspace.addPurchase(input)}
        />

        <PlannerList
          groups={workspace.groups}
          itemsById={itemsById}
          priceSummaries={workspace.priceSummaries}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onDrop={(purchase) => void workspace.dropPurchase(purchase)}
          onOpenHistory={(itemId) => setHistoryItemId(itemId)}
        />
      </div>
      {/* CheckOffSheet (Task 9) and ItemHistorySheet (Task 10) mount here. */}
    </FeaturePageShell>
  );
}
