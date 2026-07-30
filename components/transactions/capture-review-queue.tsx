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
  to_review: "Nothing waiting for review.",
  approved: "No captures have been approved yet.",
  rejected: "No captures have been rejected.",
};

/**
 * The capture inbox: one scannable row per captured item, in every section.
 *
 * Every open item used to render as a full form, which meant parsing a batch of
 * five messages produced five stacked forms to scroll past. Reviewing is the
 * common case, so the queue now reads as a list and the form lives one tap away
 * in the sheet.
 *
 * Rendered bare, like the capture page's own form: the page header already says
 * what this screen is for, so a card around it only repeated that and charged
 * inset for it. Card padding inside the page gutter inside a bordered box per
 * item cost 53px on each side of a 375px screen, leaving form inputs 269px wide.
 */
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
    // min-w-0 stops the rail's min-content width (its tabs are shrink-0 and
    // nowrap, so it measures ~490px) from propagating up and stretching the
    // page grid. The card used to absorb this with overflow-hidden; without a
    // card the constraint has to be stated.
    <div className="grid min-w-0 gap-3">
      <CaptureReviewFilterRail section={section} counts={counts} onSelect={setSection} />

      {/* min-w-0 again, and it is the same trap as the rail: this is a grid
          item, so min-width resolves to the subtree's min-content, and a
          `truncate` block contributes its full untruncated text width because
          overflow only zeroes that contribution for flex/grid items. Without it
          a long payee stretched the list to 459px and the page clipped the
          approve button off-screen. */}
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
