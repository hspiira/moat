"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveItem } from "@/lib/domain/item-normalization";
import {
  buildFulfillmentLineItem,
  estimatePlannedTotal,
  fulfillPurchase,
  groupPlannerRows,
} from "@/lib/domain/planned-purchases";
import {
  derivePriceObservations,
  summarizeItemPrices,
} from "@/lib/domain/price-observations";
import { repositories } from "@/lib/repositories/instance";
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
      ] = await Promise.all([
        repositories.items.listByUser(loadedProfile.id),
        repositories.plannedPurchases.listByUser(loadedProfile.id),
        repositories.transactionLineItems.listByUser(loadedProfile.id),
        repositories.transactions.listByUser(loadedProfile.id),
        repositories.accounts.listByUser(loadedProfile.id),
        repositories.categories.listByUser(loadedProfile.id),
      ]);
      setItems(loadedItems);
      setPurchases(loadedPurchases);
      setLineItems(loadedLines);
      setTransactions(loadedTransactions);
      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load shopping.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const today = new Date().toISOString().slice(0, 10);
  const groups = useMemo(() => groupPlannerRows(purchases, today), [purchases, today]);
  const estimate = useMemo(() => estimatePlannedTotal(purchases), [purchases]);
  const observations = useMemo(
    () => derivePriceObservations(lineItems, transactions),
    [lineItems, transactions],
  );
  const priceSummaries: Map<string, ItemPriceSummary> = useMemo(
    () => summarizeItemPrices(observations, today),
    [observations, today],
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
      quantity?: number;
      estimatedUnitPrice?: number;
      neededBy?: string;
      note?: string;
    }) => {
      if (!profile) return;
      setIsSubmitting(true);
      try {
        const timestamp = new Date().toISOString();
        const resolved = resolveItem({
          existing: items,
          rawName: input.name,
          userId: profile.id,
          timestamp,
        });
        if (resolved.isNew) {
          await repositories.items.upsert(resolved.item);
        }
        await repositories.plannedPurchases.upsert({
          id: `planned:${crypto.randomUUID()}`,
          userId: profile.id,
          itemId: resolved.item.id,
          quantity: input.quantity,
          estimatedUnitPrice: input.estimatedUnitPrice,
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

  const dropPurchase = useCallback(
    async (purchase: PlannedPurchase) => {
      await repositories.plannedPurchases.upsert({
        ...purchase,
        status: "dropped",
        updatedAt: new Date().toISOString(),
      });
      await refresh();
    },
    [refresh],
  );

  const checkOff = useCallback(
    async (selected: PlannedPurchase[], target: CheckOffTarget) => {
      if (!profile || selected.length === 0) return;
      setIsSubmitting(true);
      try {
        const timestamp = new Date().toISOString();
        let transactionId: string;
        if (target.mode === "attach") {
          transactionId = target.transactionId;
        } else {
          transactionId = `transaction:${crypto.randomUUID()}`;
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
          const lineItem = buildFulfillmentLineItem(purchase, item, transactionId, timestamp);
          await repositories.transactionLineItems.upsert(lineItem);
          await repositories.plannedPurchases.upsert(
            fulfillPurchase(purchase, lineItem, timestamp),
          );
        }
        await refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Couldn't record the purchase.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [items, profile, refresh],
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
    recentExpenses,
    accounts,
    categories,
    expenseCategories,
    addPurchase,
    dropPurchase,
    checkOff,
    refresh,
  };
}
