import type { Counterparty, CounterpartyKind, Transaction } from "@/lib/types";
import { createId } from "@/lib/ids";

/**
 * The subsidiary ledger behind the two pool control accounts.
 *
 * Grouping used to run on the `payee` text, which meant a typo created a
 * second borrower and a rename re-bucketed history. A counterparty id is
 * stable, so the name becomes a label rather than a key.
 */

export function newCounterpartyId(): string {
  return createId();
}

export function normalizeCounterpartyName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Match key for deduplication only — never displayed, never stored. */
export function counterpartyMatchKey(name: string): string {
  return normalizeCounterpartyName(name).toLowerCase();
}

export type CounterpartyDraft = {
  id: string;
  userId: string;
  name: string;
  kind: CounterpartyKind;
  timestamp: string;
  openingBalance?: number;
};

export function buildCounterparty(draft: CounterpartyDraft): Counterparty {
  return {
    id: draft.id,
    userId: draft.userId,
    name: normalizeCounterpartyName(draft.name),
    kind: draft.kind,
    openingBalance: draft.openingBalance || undefined,
    isArchived: false,
    createdAt: draft.timestamp,
    updatedAt: draft.timestamp,
  };
}

export function findCounterpartyByName(
  counterparties: Counterparty[],
  name: string,
): Counterparty | undefined {
  const key = counterpartyMatchKey(name);
  return counterparties.find((entry) => counterpartyMatchKey(entry.name) === key);
}

/**
 * Widens a counterparty's kind rather than overwriting it, so someone who has
 * both lent to and borrowed from the user keeps both roles.
 */
export function widenKind(current: CounterpartyKind, next: CounterpartyKind): CounterpartyKind {
  return current === next ? current : "both";
}

export type ResolvedCounterparty = {
  counterparty: Counterparty;
  /** True when the record is new or its kind widened — that is, needs writing. */
  changed: boolean;
};

export function resolveCounterparty(
  counterparties: Counterparty[],
  draft: CounterpartyDraft,
): ResolvedCounterparty {
  const existing = findCounterpartyByName(counterparties, draft.name);

  if (!existing) {
    return { counterparty: buildCounterparty(draft), changed: true };
  }

  const kind = widenKind(existing.kind, draft.kind);
  if (kind === existing.kind) {
    return { counterparty: existing, changed: false };
  }

  return {
    counterparty: { ...existing, kind, updatedAt: draft.timestamp },
    changed: true,
  };
}

export type CounterpartyBackfill = {
  counterparties: Counterparty[];
  transactions: Transaction[];
};

export type BackfillRequest = {
  transactions: Transaction[];
  existing: Counterparty[];
  /** Which pool account implies which role. */
  poolKinds: Map<string, CounterpartyKind>;
  userId: string;
  timestamp: string;
  nextId: () => string;
};

/**
 * Turns the distinct payees already recorded against the pools into
 * counterparty records, and stamps the resulting id onto those transactions.
 *
 * Runs once per device. Rows with no payee are left alone: inventing a party
 * for them would assert an identity the user never gave.
 */
export function backfillCounterparties(request: BackfillRequest): CounterpartyBackfill {
  const { transactions, existing, poolKinds, userId, timestamp, nextId } = request;

  const byKey = new Map(existing.map((entry) => [counterpartyMatchKey(entry.name), entry]));
  const touched = new Map<string, Counterparty>();
  const stamped: Transaction[] = [];

  for (const transaction of transactions) {
    const kind = poolKinds.get(transaction.accountId);
    const name = transaction.payee?.trim();
    if (!kind || transaction.counterpartyId || !name) {
      continue;
    }

    const key = counterpartyMatchKey(name);
    const match = byKey.get(key);
    let counterparty: Counterparty;

    if (!match) {
      counterparty = buildCounterparty({ id: nextId(), userId, name, kind, timestamp });
      touched.set(counterparty.id, counterparty);
    } else {
      const widened = widenKind(match.kind, kind);
      counterparty = widened === match.kind ? match : { ...match, kind: widened, updatedAt: timestamp };
      if (counterparty !== match) {
        touched.set(counterparty.id, counterparty);
      }
    }

    byKey.set(key, counterparty);

    stamped.push({ ...transaction, counterpartyId: counterparty.id, updatedAt: timestamp });
  }

  return { counterparties: [...touched.values()], transactions: stamped };
}
