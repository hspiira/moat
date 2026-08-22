"use client";

import { useMemo, useState } from "react";

import type { Account, CaptureReviewItem, Category, Transaction } from "@/lib/types";
import {
  getSectionCounts,
  getSectionItems,
  type CaptureReviewSection,
} from "@/lib/domain/capture-review";
import { EmptyState } from "@/components/ui/empty-state";

import { CaptureReviewDetailSheet } from "./capture-review-detail-sheet";
import { CaptureReviewFilterRail } from "./capture-review-filter-rail";
import { CaptureReviewRow } from "./capture-review-row";

type CaptureReviewQueueProps = {
  accounts: Account[];
  categories: Category[];
  items: CaptureReviewItem[];
  transactions: Transaction[];
  isSubmitting: boolean;
  onApprove: (item: CaptureReviewItem) => Promise<void>;
  onReject: (item: CaptureReviewItem) => Promise<void>;
  onMarkDuplicate: (item: CaptureReviewItem) => Promise<void>;
  onClearDuplicate: (item: CaptureReviewItem) => Promise<void>;
  onUpdateItem: (item: CaptureReviewItem) => Promise<void>;
};

const emptyMessages: Record<CaptureReviewSection, string> = {
  to_review:
    "Nothing waiting. Paste an SMS or a mobile-money notification and what it reads lands here first, so you can check it before it counts.",
  approved: "Nothing approved yet. What you approve here becomes a transaction.",
  rejected: "Nothing rejected yet. What you reject here is left out of your totals.",
};

export function CaptureReviewQueue({
  accounts,
  categories,
  items,
  transactions,
  isSubmitting,
  onApprove,
  onReject,
  onMarkDuplicate,
  onClearDuplicate,
  onUpdateItem,
}: CaptureReviewQueueProps) {
  const [section, setSection] = useState<CaptureReviewSection>("to_review");
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const counts = useMemo(() => getSectionCounts(items), [items]);
  const sectionItems = useMemo(() => getSectionItems(items, section), [items, section]);
  const openItem = useMemo(
    () => items.find((item) => item.id === openItemId) ?? null,
    [items, openItemId],
  );

  return (
    <div className="grid min-w-0 gap-3">
      <CaptureReviewFilterRail section={section} counts={counts} onSelect={setSection} />

      <div className="min-w-0">
        {sectionItems.length === 0 ? (
          <EmptyState className="py-10">{emptyMessages[section]}</EmptyState>
        ) : (
          <div className="divide-y divide-border/60">
            {sectionItems.map((item) => (
              <CaptureReviewRow
                key={item.id}
                item={item}
                accounts={accounts}
                categories={categories}
                isSubmitting={isSubmitting}
                onOpen={(opened) => setOpenItemId(opened.id)}
                onApprove={(approved) => void onApprove(approved)}
              />
            ))}
          </div>
        )}
      </div>

      <CaptureReviewDetailSheet
        item={openItem}
        accounts={accounts}
        categories={categories}
        items={items}
        transactions={transactions}
        isSubmitting={isSubmitting}
        onApprove={onApprove}
        onReject={onReject}
        onMarkDuplicate={onMarkDuplicate}
        onClearDuplicate={onClearDuplicate}
        onUpdateItem={onUpdateItem}
        onOpenChange={(open) => (open ? undefined : setOpenItemId(null))}
      />
    </div>
  );
}
