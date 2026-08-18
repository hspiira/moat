"use client";

import { useCallback, useState } from "react";

import { repositories } from "@/lib/repositories/instance";
import {
  backfillCounterparties,
  newCounterpartyId,
  resolveCounterparty,
} from "@/lib/domain/counterparties";
import { planCounterpartyMerge } from "@/lib/domain/counterparty-merge";
import { poolCounterpartyKinds } from "@/lib/domain/reserved-accounts";
import {
  NEW_COUNTERPARTY,
  counterpartyKindForDirection,
  type TransferDirection,
} from "@/lib/domain/transfer-counterparty";
import type { Counterparty, Transaction } from "@/lib/types";

export type CounterpartySelection = {
  counterpartyId: string;
  counterpartyName: string;
};

export function useCounterparties() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);

  const loadAndBackfill = useCallback(
    async (userId: string, transactions: Transaction[]): Promise<Transaction[]> => {
      const stored = await repositories.counterparties.listByUser(userId);
      const backfill = backfillCounterparties({
        transactions,
        existing: stored,
        poolKinds: poolCounterpartyKinds(userId),
        userId,
        timestamp: new Date().toISOString(),
        nextId: newCounterpartyId,
      });

      if (backfill.counterparties.length > 0 || backfill.transactions.length > 0) {
        await Promise.all([
          ...backfill.counterparties.map((entry) => repositories.counterparties.upsert(entry)),
          ...backfill.transactions.map((row) => repositories.transactions.upsert(row)),
        ]);
      }

      const stamped = new Map(backfill.transactions.map((row) => [row.id, row]));
      const afterBackfill = transactions.map((row) => stamped.get(row.id) ?? row);
      const afterBackfillParties = [...stored, ...backfill.counterparties];

      const merge = planCounterpartyMerge(
        afterBackfillParties,
        afterBackfill,
        new Date().toISOString(),
      );

      if (merge.removedIds.length === 0) {
        setCounterparties(afterBackfillParties);
        return afterBackfill;
      }

      await Promise.all([
        ...merge.counterparties.map((entry) => repositories.counterparties.upsert(entry)),
        ...merge.transactions.map((row) => repositories.transactions.upsert(row)),
      ]);
      await Promise.all(
        merge.removedIds.map((id) => repositories.counterparties.remove(id)),
      );
      console.warn(
        `Moat: merged ${merge.removedIds.length} duplicate counterparty record(s).`,
        merge.removedIds,
      );

      const removed = new Set(merge.removedIds);
      const survivors = new Map(merge.counterparties.map((entry) => [entry.id, entry]));
      setCounterparties(
        afterBackfillParties
          .filter((entry) => !removed.has(entry.id))
          .map((entry) => survivors.get(entry.id) ?? entry),
      );

      const repointed = new Map(merge.transactions.map((row) => [row.id, row]));
      return afterBackfill.map((row) => repointed.get(row.id) ?? row);
    },
    [],
  );

  const resolveSelection = useCallback(
    async (params: {
      userId: string;
      timestamp: string;
      direction: TransferDirection | undefined;
      selection: CounterpartySelection;
    }): Promise<Counterparty | null> => {
      const { userId, timestamp, direction, selection } = params;

      if (selection.counterpartyId && selection.counterpartyId !== NEW_COUNTERPARTY) {
        return counterparties.find((entry) => entry.id === selection.counterpartyId) ?? null;
      }
      if (!selection.counterpartyName.trim() || !direction) {
        return null;
      }

      const stored = await repositories.counterparties.listByUser(userId);
      const { counterparty, changed } = resolveCounterparty(stored, {
        name: selection.counterpartyName,
        kind: counterpartyKindForDirection(direction),
        userId,
        id: newCounterpartyId(),
        timestamp,
      });

      if (changed) {
        await repositories.counterparties.upsert(counterparty);
      }
      return counterparty;
    },
    [counterparties],
  );

  return { counterparties, setCounterparties, loadAndBackfill, resolveSelection };
}
