"use client";

import { useCallback } from "react";

import { resolveItem } from "@/lib/domain/item-normalization";
import { revertPurchase } from "@/lib/domain/planned-purchases";
import { errorMessage } from "@/lib/errors";
import { repositories } from "@/lib/repositories/instance";
import type { TransactionLineItem, UserProfile } from "@/lib/types";
import { createId } from "@/lib/ids";

export type LineItemInput = {
  id?: string;
  transactionId: string;
  label: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  categoryId?: string;
};

export function useLineItems({
  profile,
  lineItems,
  onMutated,
  setIsSubmitting,
  setError,
  show,
}: {
  profile: UserProfile | null;
  lineItems: TransactionLineItem[];
  onMutated: () => Promise<void>;
  setIsSubmitting: (value: boolean) => void;
  setError: (value: string | null) => void;
  show: (message: string, tone: "error" | "success") => void;
}) {
  const saveLineItem = useCallback(
    async (input: LineItemInput) => {
      if (!profile) return;
      setIsSubmitting(true);
      setError(null);
      try {
        const timestamp = new Date().toISOString();
        const existingItems = await repositories.items.listByUser(profile.id);
        const resolved = resolveItem({
          existing: existingItems,
          rawName: input.label,
          userId: profile.id,
          timestamp,
        });
        if (resolved.isNew) {
          await repositories.items.upsert(resolved.item);
        }
        const existing = input.id
          ? lineItems.find((line) => line.id === input.id)
          : undefined;
        await repositories.transactionLineItems.upsert({
          id: input.id ?? createId(),
          userId: profile.id,
          transactionId: input.transactionId,
          itemId: resolved.item.id,
          label: input.label.trim(),
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          amount: input.amount,
          categoryId: input.categoryId,
          plannedPurchaseId: existing?.plannedPurchaseId,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        });
        await onMutated();
      } catch (saveError) {
        const message = errorMessage(saveError, "Couldn't save the item.");
        setError(message);
        show(message, "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [lineItems, onMutated, profile, setError, setIsSubmitting, show],
  );

  const deleteLineItem = useCallback(
    async (lineItem: TransactionLineItem) => {
      if (!profile) return;
      setIsSubmitting(true);
      setError(null);
      try {
        const timestamp = new Date().toISOString();
        await repositories.transactionLineItems.remove(lineItem.id);
        if (lineItem.plannedPurchaseId) {
          const purchase = await repositories.plannedPurchases.getById(
            lineItem.plannedPurchaseId,
          );
          if (purchase) {
            await repositories.plannedPurchases.upsert(revertPurchase(purchase, timestamp));
          }
        }
        await onMutated();
      } catch (deleteError) {
        const message = errorMessage(deleteError, "Couldn't delete the item.");
        setError(message);
        show(message, "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [onMutated, profile, setError, setIsSubmitting, show],
  );

  return { saveLineItem, deleteLineItem };
}
