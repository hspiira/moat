import type { Counterparty, CounterpartyKind, Transaction } from "@/lib/types";
import { createId } from "@/lib/ids";

export function newCounterpartyId(): string {
  return createId();
}

export function normalizeCounterpartyName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

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

export function widenKind(current: CounterpartyKind, next: CounterpartyKind): CounterpartyKind {
  return current === next ? current : "both";
}

export type ResolvedCounterparty = {
  counterparty: Counterparty;
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
  poolKinds: Map<string, CounterpartyKind>;
  userId: string;
  timestamp: string;
  nextId: () => string;
};

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
