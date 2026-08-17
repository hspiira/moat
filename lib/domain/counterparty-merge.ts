import { counterpartyMatchKey, widenKind } from "@/lib/domain/counterparties";
import type { Counterparty, Transaction } from "@/lib/types";

export type CounterpartyMerge = {
  /** Survivors that changed and need writing. */
  counterparties: Counterparty[];
  /** Transactions repointed at a survivor. */
  transactions: Transaction[];
  /** Duplicates to delete, only after the repointed rows are stored. */
  removedIds: string[];
};

// Dedupe used to live only in resolveCounterparty, on one code path. Anything
// reaching the store another way created a second record for the same person,
// and nothing ever reconciled them: one borrower could appear four times, each
// holding part of the balance, while the pool total stayed correct.
//
// Same normalized name means the same person here — findCounterpartyByName has
// always treated it that way. This makes that rule hold for stored records too.
export function planCounterpartyMerge(
  counterparties: Counterparty[],
  transactions: Transaction[],
  timestamp: string,
): CounterpartyMerge {
  const groups = new Map<string, Counterparty[]>();
  for (const entry of counterparties) {
    const key = counterpartyMatchKey(entry.name);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const survivorFor = new Map<string, string>();
  const survivors: Counterparty[] = [];
  const removedIds: string[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // Oldest wins, id breaking ties, so the outcome does not depend on read order.
    const ordered = [...group].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
    const [survivor, ...duplicates] = ordered;

    const merged: Counterparty = {
      ...survivor,
      kind: ordered.reduce<Counterparty["kind"]>(
        (kind, entry) => widenKind(kind, entry.kind),
        survivor.kind,
      ),
      // Each duplicate may carry part of the pre-existing balance.
      openingBalance:
        ordered.reduce((sum, entry) => sum + (entry.openingBalance ?? 0), 0) || undefined,
      phone: ordered.find((entry) => entry.phone)?.phone,
      notes: ordered.find((entry) => entry.notes)?.notes,
      // Archived only if every copy was.
      isArchived: ordered.every((entry) => entry.isArchived),
      updatedAt: timestamp,
    };

    survivors.push(merged);
    for (const duplicate of duplicates) {
      survivorFor.set(duplicate.id, merged.id);
      removedIds.push(duplicate.id);
    }
  }

  const repointed = transactions
    .filter((entry) => entry.counterpartyId && survivorFor.has(entry.counterpartyId))
    .map((entry) => ({
      ...entry,
      counterpartyId: survivorFor.get(entry.counterpartyId as string),
      updatedAt: timestamp,
    }));

  return { counterparties: survivors, transactions: repointed, removedIds };
}
