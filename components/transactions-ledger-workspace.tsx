"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconAdjustmentsHorizontal, IconSearch, IconX } from "@tabler/icons-react";

import { partyByTransferGroup } from "@/lib/domain/party-name";
import { searchTransactions } from "@/lib/domain/transaction-search";
import {
  filterByWindow,
  LEDGER_WINDOWS,
  parseLedgerSort,
  parseLedgerWindow,
  sortForLedger,
  type LedgerSort,
  type LedgerWindow,
} from "@/lib/domain/ledger-view";
import { todayIso } from "@/lib/today";

import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { TransactionForm } from "./transactions/transaction-form";
import { TransactionsSummaryStrip } from "./transactions/transactions-summary-strip";
import { TransactionList } from "./transactions/transaction-list";
import { TransactionDetailSheet } from "./transactions/transaction-detail-sheet";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";
import { TransactionsWorkspaceFrame } from "./transactions/transactions-workspace-frame";
import { useIncrementalList } from "@/components/hooks/use-incremental-list";

const LEDGER_PAGE_SIZE = 25;

const WINDOW_OPTIONS = [
  ...LEDGER_WINDOWS.map((days) => ({ value: days as LedgerWindow, label: `${days} days` })),
  { value: null as LedgerWindow, label: "All time" },
];

const SORT_OPTIONS: ReadonlyArray<{ value: LedgerSort; label: string }> = [
  { value: "recent", label: "Newest" },
  { value: "largest", label: "Biggest out" },
];

export function TransactionsLedgerWorkspace() {
  const workspace = useTransactionsWorkspace();
  // Insights link here with the thing they are about already typed in, so the
  // list you land on is the list the insight was talking about.
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [window_, setWindow] = useState<LedgerWindow>(parseLedgerWindow(params.get("days")));
  const [sort, setSort] = useState<LedgerSort>(parseLedgerSort(params.get("sort")));
  // Shopping links a bought item straight at the transaction that paid for it,
  // so the receipt is one tap from the plan rather than a search away.
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(
    params.get("transaction"),
  );
  // Period and order are one decision made rarely, so they wait behind Filters
  // rather than standing between the search box and the first record.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visibleTransactions = useMemo(
    () =>
      sortForLedger(
        filterByWindow(
          searchTransactions(
            workspace.transactions,
            query,
            workspace.accounts,
            workspace.categories,
          ),
          window_,
          todayIso(),
        ),
        sort,
      ),
    [workspace.transactions, query, workspace.accounts, workspace.categories, window_, sort],
  );

  const {
    visible: pageTransactions,
    hasMore,
    shownCount,
    totalCount,
    sentinelRef,
    showMore,
  } = useIncrementalList(visibleTransactions, {
    pageSize: LEDGER_PAGE_SIZE,
    resetKey: `${query}|${window_}|${sort}`,
  });
  const partyByGroup = useMemo(
    () => partyByTransferGroup(workspace.transactions),
    [workspace.transactions],
  );
  const isEditing = Boolean(workspace.editingTransactionId);
  const detailTransaction =
    workspace.transactions.find((transaction) => transaction.id === detailTransactionId) ?? null;

  const windowLabel = window_ ? `Last ${window_} days` : "All time";
  const activeFilterCount = (window_ === null ? 0 : 1) + (sort === "recent" ? 0 : 1);
  const monthNeedsCheck = workspace.reviewCount > 0 || workspace.duplicateCount > 0;

  return (
    <TransactionsWorkspaceFrame
      title="Transactions"
      profile={workspace.profile}
      isLoading={workspace.isLoading}
      error={workspace.error}
    >
      <div className="grid gap-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search payee, category, note, or amount"
              aria-label="Search transactions"
              className="h-11 w-full rounded-lg bg-muted/50 pr-10 pl-10 text-base sm:text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                }}
                className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <IconX className="size-4" />
              </button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 px-3"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(true)}
          >
            <IconAdjustmentsHorizontal aria-hidden className="size-4" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{windowLabel}</span>
          {query && visibleTransactions.length > 0 ? (
            <span role="status">
              {visibleTransactions.length}{" "}
              {visibleTransactions.length === 1 ? "match" : "matches"}
            </span>
          ) : null}
        </div>

        {workspace.captureReviewCount > 0 || monthNeedsCheck ? (
          <Card className="bg-muted/20 shadow-none">
            <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 text-sm text-muted-foreground">
                {[
                  workspace.captureReviewCount > 0
                    ? `${workspace.captureReviewCount} captured ${workspace.captureReviewCount === 1 ? "entry" : "entries"} to review`
                    : null,
                  workspace.reviewCount > 0 ? `${workspace.reviewCount} unposted` : null,
                  workspace.duplicateCount > 0
                    ? `${workspace.duplicateCount} possibly duplicated`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                .
              </div>
              <div className="flex shrink-0 gap-2">
                {workspace.captureReviewCount > 0 ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/inbox">Open inbox</Link>
                  </Button>
                ) : null}
                {monthNeedsCheck ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/month">Month check</Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <TransactionsSummaryStrip
          recordedCount={workspace.transactions.length}
          transactionCount={workspace.periodTransactions.length}
          reviewCount={workspace.reviewCount}
          captureInboxCount={workspace.captureReviewCount}
          duplicateCount={workspace.duplicateCount}
          summary={workspace.periodSummary}
        />

        {visibleTransactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {query
              ? `No transactions match "${query.trim()}"${window_ ? ` in the last ${window_} days` : ""}.`
              : window_
                ? `Nothing recorded in the last ${window_} days.`
                : "Nothing recorded yet."}
          </p>
        ) : null}

        <TransactionList
          grouped={sort === "recent"}
          caption={
            sort === "largest"
              ? "Biggest money out first. Transfers show as a matched pair."
              : "Newest first. Transfers show as a matched pair."
          }
          accounts={workspace.accounts}
          categories={workspace.categories}
          counterparties={workspace.counterparties}
          partyByGroup={partyByGroup}
          transactions={pageTransactions}
          pendingSyncIds={workspace.pendingSyncTransactionIds}
          onOpenDetail={(transaction) => setDetailTransactionId(transaction.id)}
        />

        {hasMore ? (
          <div className="grid justify-items-center gap-1">
            <p className="text-xs text-muted-foreground">
              {shownCount} of {totalCount}
            </p>
            <Button size="sm" variant="ghost" onClick={showMore}>
              Show older
            </Button>
          </div>
        ) : null}
        <div ref={sentinelRef} aria-hidden className="h-px" />
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="px-0">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              These change the list below. The month summary stays on the calendar month.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 pb-2">
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Period</p>
              <FilterChips
                label="Period"
                options={WINDOW_OPTIONS}
                value={window_}
                onChange={setWindow}
              />
            </div>
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Order</p>
              <FilterChips label="Order" options={SORT_OPTIONS} value={sort} onChange={setSort} />
            </div>
            <SheetClose asChild>
              <Button type="button" size="lg" className="w-full">
                Show transactions
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>

      <TransactionDetailSheet
        counterparties={workspace.counterparties}
        partyByGroup={partyByGroup}
        onEdit={(transaction) => {
          setDetailTransactionId(null);
          workspace.beginTransactionEdit(transaction);
        }}
        onDelete={(transaction) => {
          setDetailTransactionId(null);
          void workspace.handleDeleteTransaction(transaction);
        }}
        onOpenTransaction={(transaction) => setDetailTransactionId(transaction.id)}
        transaction={detailTransaction}
        transactions={workspace.transactions}
        accounts={workspace.accounts}
        categories={workspace.categories}
        lineItems={workspace.lineItems}
        isSubmitting={workspace.isSubmitting}
        onOpenChange={(open) => (open ? undefined : setDetailTransactionId(null))}
        onSaveLineItem={(input) => void workspace.saveLineItem(input)}
        onDeleteLineItem={(lineItem) => void workspace.deleteLineItem(lineItem)}
      />

      <Sheet open={isEditing} onOpenChange={(open) => (open ? undefined : workspace.cancelEdit())}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <SheetHeader className="sr-only">
            <SheetTitle>Edit transaction</SheetTitle>
            <SheetDescription>Update the selected transaction and save.</SheetDescription>
          </SheetHeader>
          {isEditing ? (
            <div className="pt-2">
              <TransactionForm
                embedded
                accounts={workspace.accounts}
                categories={workspace.categories}
                categoryUsage={workspace.categoryUsage}
                onCreateCategory={(name, kind) => void workspace.createCategory(name, kind)}
                counterparties={workspace.counterparties}
                projects={workspace.projects}
                transactions={workspace.transactions}
                form={workspace.transactionForm}
                editingId={workspace.editingTransactionId}
                isSubmitting={workspace.isSubmitting}
                lastSavedAt={workspace.lastSavedAt}
                successMessage={workspace.successMessage}
                rememberedFxHint={workspace.rememberedFxHint}
                onFormChange={workspace.setTransactionForm}
                onSubmit={(event) => void workspace.handleTransactionSubmit(event)}
                onCancelEdit={workspace.cancelEdit}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </TransactionsWorkspaceFrame>
  );
}
