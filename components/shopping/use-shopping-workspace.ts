"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getBudgetEnvelopes } from "@/lib/domain/budgets";
import { learnItemCategory } from "@/lib/domain/item-category";
import { comparePlannedWithBudget } from "@/lib/domain/planned-against-budget";
import { summariseInstallments } from "@/lib/domain/installments";
import { resolveItem } from "@/lib/domain/item-normalization";
import {
  buildFulfillmentLineItem,
  estimatePlannedTotal,
  fulfillPurchase,
  groupPlannerRows,
  revertPurchase,
} from "@/lib/domain/planned-purchases";
import {
  derivePriceObservations,
  summarizeItemPrices,
} from "@/lib/domain/price-observations";
import { repositories } from "@/lib/repositories/instance";
import type { BudgetTarget } from "@/lib/types";
import type {
  Account,
  Category,
  Item,
  ItemPriceSummary,
  PlannedPurchase,
  Transaction,
  TransactionLineItem,
  UserProfile,
} from "@/lib/types";
import { createId } from "@/lib/ids";
import { todayIso } from "@/lib/today";

export type FulfillmentActual = {
  purchaseId: string;
  quantity?: number;
  unitPrice?: number;
};

export type CheckOffTarget =
  | { mode: "attach"; transactionId: string }
  | {
      mode: "create";
      accountId: string;
      categoryId: string;
      payee: string;
      occurredOn: string;
      amount: number;
    };

export function useShoppingWorkspace() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [budgets, setBudgets] = useState<BudgetTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<PlannedPurchase[]>([]);
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const loadedProfile = await repositories.userProfile.get();
      setProfile(loadedProfile);
      if (!loadedProfile) return;
      const [
        loadedItems,
        loadedPurchases,
        loadedLines,
        loadedTransactions,
        loadedAccounts,
        loadedCategories,
        loadedBudgets,
      ] = await Promise.all([
        repositories.items.listByUser(loadedProfile.id),
        repositories.plannedPurchases.listByUser(loadedProfile.id),
        repositories.transactionLineItems.listByUser(loadedProfile.id),
        repositories.transactions.listByUser(loadedProfile.id),
        repositories.accounts.listByUser(loadedProfile.id),
        repositories.categories.listByUser(loadedProfile.id),
        repositories.budgets.listByUser(loadedProfile.id),
      ]);
      setItems(loadedItems);
      setPurchases(loadedPurchases);
      setLineItems(loadedLines);
      setTransactions(loadedTransactions);
      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
      setBudgets(loadedBudgets);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load shopping.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const today = todayIso();
  const groups = useMemo(() => groupPlannerRows(purchases, today), [purchases, today]);
  const observations = useMemo(
    () => derivePriceObservations(lineItems, transactions),
    [lineItems, transactions],
  );
  const priceSummaries: Map<string, ItemPriceSummary> = useMemo(
    () => summarizeItemPrices(observations, today),
    [observations, today],
  );
  const lastPaidFor = useCallback(
    (itemId: string) => {
      const paid = priceSummaries.get(itemId)?.lastPaid;
      if (!paid) return undefined;
      return paid.unitPrice ?? (paid.amount != null ? paid.amount / (paid.quantity ?? 1) : undefined);
    },
    [priceSummaries],
  );
  const estimate = useMemo(
    () => estimatePlannedTotal(purchases, lastPaidFor),
    [lastPaidFor, purchases],
  );
  const againstBudget = useMemo(
    () =>
      comparePlannedWithBudget({
        purchases,
        items,
        envelopes: getBudgetEnvelopes(budgets, categories, transactions),
        lastPaidFor,
      }),
    [budgets, categories, items, lastPaidFor, purchases, transactions],
  );
  const recentExpenses = useMemo(
    () =>
      transactions
        .filter((entry) => entry.type === "expense")
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
        .slice(0, 15),
    [transactions],
  );
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === "expense"),
    [categories],
  );

  const addPurchase = useCallback(
    async (input: {
      name: string;
      unit?: string;
      group?: string;
      quantity?: number;
      estimatedUnitPrice?: number;
      expectedTotal?: number;
      neededBy?: string;
      note?: string;
    }) => {
      if (!profile) return;
      setIsSubmitting(true);
      setError(null);
      try {
        const timestamp = new Date().toISOString();
        const resolved = resolveItem({
          existing: items,
          rawName: input.name,
          userId: profile.id,
          timestamp,
          unit: input.unit,
          group: input.group,
        });
        if (resolved.isNew) {
          await repositories.items.upsert(resolved.item);
        }
        await repositories.plannedPurchases.upsert({
          id: createId(),
          userId: profile.id,
          itemId: resolved.item.id,
          quantity: input.quantity,
          estimatedUnitPrice: input.estimatedUnitPrice,
          expectedTotal: input.expectedTotal,
          neededBy: input.neededBy,
          note: input.note,
          status: "planned",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        await refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Couldn't add the item.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [items, profile, refresh],
  );

  const editPurchase = useCallback(
    async (
      purchase: PlannedPurchase,
      patch: {
        quantity?: number;
        estimatedUnitPrice?: number;
        expectedTotal?: number;
        neededBy?: string;
        note?: string;
      },
    ) => {
      if (purchase.status === "purchased") return;
      setIsSubmitting(true);
      setError(null);
      try {
        await repositories.plannedPurchases.upsert({
          ...purchase,
          ...patch,
          updatedAt: new Date().toISOString(),
        });
        await refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Couldn't update the item.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  const restorePurchase = useCallback(
    async (purchase: PlannedPurchase) => {
      if (purchase.status !== "dropped") return;
      setIsSubmitting(true);
      setError(null);
      try {
        await repositories.plannedPurchases.upsert(
          revertPurchase(purchase, new Date().toISOString()),
        );
        await refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Couldn't put the item back on the list.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  const dropPurchase = useCallback(
    async (purchase: PlannedPurchase) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await repositories.plannedPurchases.upsert({
          ...purchase,
          status: "dropped",
          updatedAt: new Date().toISOString(),
        });
        await refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Couldn't drop the item.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  const checkOff = useCallback(
    async (
      selected: PlannedPurchase[],
      target: CheckOffTarget,
      actuals: FulfillmentActual[] = [],
    ): Promise<boolean> => {
      if (!profile || selected.length === 0) return false;
      const actualsByPurchaseId = new Map(actuals.map((entry) => [entry.purchaseId, entry]));
      setIsSubmitting(true);
      setError(null);
      try {
        const timestamp = new Date().toISOString();
        let transactionId: string;
        // Attaching to an existing expense means its category is the one that
        // counts, not one the sheet asked for.
        let filedUnder: string | undefined;
        if (target.mode === "attach") {
          transactionId = target.transactionId;
          filedUnder = transactions.find((entry) => entry.id === transactionId)?.categoryId;
        } else {
          filedUnder = target.categoryId;
          transactionId = createId();
          await repositories.transactions.upsert({
            id: transactionId,
            userId: profile.id,
            accountId: target.accountId,
            type: "expense",
            amount: target.amount,
            currency: "UGX",
            originalAmount: target.amount,
            occurredOn: target.occurredOn,
            categoryId: target.categoryId,
            reconciliationState: "posted",
            source: "manual",
            payee: target.payee.trim() || undefined,
            reviewedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
        const itemsById = new Map(items.map((item) => [item.id, item]));
        for (const purchase of selected) {
          const item = itemsById.get(purchase.itemId);
          if (!item) continue;
          const actual = actualsByPurchaseId.get(purchase.id) ?? {};
          const lineItem = buildFulfillmentLineItem(
            purchase,
            item,
            transactionId,
            timestamp,
            actual,
          );
          await repositories.transactionLineItems.upsert(lineItem);
          // What is already paid decides whether this payment settles the item
          // or leaves it on the list with a balance.
          const paidBefore = summariseInstallments(purchase, lineItems).paid;
          await repositories.plannedPurchases.upsert(
            fulfillPurchase(purchase, lineItem, timestamp, paidBefore),
          );

          // Where the spending was filed is the item's category. Learned here so
          // a shopping list can be weighed against a budget without ever asking.
          const learned = filedUnder ? learnItemCategory(item, filedUnder, timestamp) : null;
          if (learned) {
            await repositories.items.upsert(learned);
          }
        }
        await refresh();
        return true;
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Couldn't record the purchase.",
        );
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [items, lineItems, profile, refresh, transactions],
  );

  return {
    profile,
    isLoading,
    error,
    isSubmitting,
    items,
    purchases,
    groups,
    estimate,
    observations,
    priceSummaries,
    lastPaidFor,
    againstBudget,
    recentExpenses,
    lineItems,
    transactions,
    accounts,
    categories,
    expenseCategories,
    addPurchase,
    editPurchase,
    dropPurchase,
    restorePurchase,
    checkOff,
    refresh,
  };
}
