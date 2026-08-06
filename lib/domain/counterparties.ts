import type { Counterparty, CounterpartyKind, Transaction } from "@/lib/types";

/**
 * The subsidiary ledger behind the two pool control accounts.
 *
 * Grouping used to run on the `payee` text, which meant a typo created a
 * second borrower and a rename re-bucketed history. A counterparty id is
 * stable, so the name becomes a label rather than a key.
 */

export const UNKNOWN_COUNTERPARTY_KEY = "counterparty:unknown";

export function normalizeCounterpartyName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Match key for deduplication only — never displayed, never stored. */
export function counterpartyMatchKey(name: string): string {
  return normalizeCounterpartyName(name).toLowerCase();
}

export function buildCounterparty(params: {
  id: string;
  userId: string;
  name: string;
  kind: CounterpartyKind;
  timestamp: string;
  openingBalance?: number;
}): Counterparty {
  return {
    id: params.id,
    userId: params.userId,
    name: normalizeCounterpartyName(params.name),
    kind: params.kind,
    openingBalance: params.openingBalance || undefined,
    isArchived: false,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
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
  isNew: boolean;
};

export function resolveCounterparty(
  counterparties: Counterparty[],
  params: { name: string; kind: CounterpartyKind; userId: string; id: string; timestamp: string },
): ResolvedCounterparty {
  const existing = findCounterpartyByName(counterparties, params.name);

  if (existing) {
    const kind = widenKind(existing.kind, params.kind);
    return {
      counterparty:
        kind === existing.kind
          ? existing
          : { ...existing, kind, updatedAt: params.timestamp },
      isNew: false,
    };
  }

  return { counterparty: buildCounterparty(params), isNew: true };
}

export type CounterpartyBackfill = {
  counterparties: Counterparty[];
  transactions: Transaction[];
};

/**
 * Turns the distinct payees already recorded against the pools into
 * counterparty records, and stamps the resulting id onto those transactions.
 *
 * Runs once per device. Rows with no payee are left alone: inventing a party
 * for them would assert an identity the user never gave.
 */
export function backfillCounterparties(
  transactions: Transaction[],
  existing: Counterparty[],
  poolKinds: Map<string, CounterpartyKind>,
  userId: string,
  timestamp: string,
  nextId: () => string,
): CounterpartyBackfill {
  const resolved = [...existing];
  const byKey = new Map(resolved.map((entry) => [counterpartyMatchKey(entry.name), entry]));
  const created: Counterparty[] = [];
  const updated = new Map<string, Counterparty>();
  const stamped: Transaction[] = [];

  for (const transaction of transactions) {
    const kind = poolKinds.get(transaction.accountId);
    const name = transaction.payee?.trim();
    if (!kind || transaction.counterpartyId || !name) {
      continue;
    }

    const key = counterpartyMatchKey(name);
    const match = byKey.get(key);

    if (!match) {
      const counterparty = buildCounterparty({
        id: nextId(),
        userId,
        name,
        kind,
        timestamp,
      });
      byKey.set(key, counterparty);
      created.push(counterparty);
      stamped.push({ ...transaction, counterpartyId: counterparty.id, updatedAt: timestamp });
      continue;
    }

    const widened = widenKind(match.kind, kind);
    if (widened !== match.kind) {
      const next = { ...match, kind: widened, updatedAt: timestamp };
      byKey.set(key, next);
      if (created.some((entry) => entry.id === next.id)) {
        created[created.findIndex((entry) => entry.id === next.id)] = next;
      } else {
        updated.set(next.id, next);
      }
    }

    stamped.push({ ...transaction, counterpartyId: match.id, updatedAt: timestamp });
  }

  return {
    counterparties: [...created, ...updated.values()],
    transactions: stamped,
  };
}
