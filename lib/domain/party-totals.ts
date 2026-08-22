import { getTransactionBalanceDelta } from "@/lib/domain/accounts";
import { isFeeTransaction } from "@/lib/domain/fees";
import type { Counterparty, Transaction } from "@/lib/types";

export type PartyTotal = {
  key: string;
  name: string;
  counterpartyId?: string;
  amount: number;
  count: number;
  perTime: number;
  fees: number;
  categoryIds: string[];
};

export type PartyMovement = {
  out: PartyTotal[];
  in: PartyTotal[];
};

export function partyKeyOf(transaction: Transaction): string | null {
  if (transaction.counterpartyId) return `party:${transaction.counterpartyId}`;
  const name = (transaction.payee ?? transaction.rawPayee ?? "").trim().toLowerCase();
  return name ? `name:${name}` : null;
}

function displayName(transaction: Transaction, byId: Map<string, Counterparty>): string {
  const named = transaction.counterpartyId ? byId.get(transaction.counterpartyId) : undefined;
  return named?.name ?? transaction.payee ?? transaction.rawPayee ?? "Unknown";
}

// A transfer between the owner's own accounts has no other party, and a charge
// belongs to whoever was being paid rather than standing on its own.
function isBetweenOwnAccounts(transaction: Transaction): boolean {
  return transaction.type === "transfer" && !transaction.counterpartyId;
}

function accumulate(
  transactions: Transaction[],
  counterparties: Counterparty[],
  direction: "out" | "in",
): PartyTotal[] {
  const byId = new Map(counterparties.map((party) => [party.id, party]));
  const totals = new Map<string, PartyTotal>();

  for (const transaction of transactions) {
    if (isBetweenOwnAccounts(transaction)) continue;

    const key = partyKeyOf(transaction);
    if (!key) continue;

    const delta = getTransactionBalanceDelta(transaction);
    const moved = direction === "out" ? Math.max(0, -delta) : Math.max(0, delta);
    if (moved === 0) continue;

    const fee = isFeeTransaction(transaction);
    const held = totals.get(key);

    if (!held) {
      totals.set(key, {
        key,
        name: displayName(transaction, byId),
        counterpartyId: transaction.counterpartyId,
        amount: moved,
        count: fee ? 0 : 1,
        perTime: fee ? 0 : moved,
        fees: fee ? moved : 0,
        categoryIds: [transaction.categoryId],
      });
      continue;
    }

    held.amount += moved;
    if (fee) {
      held.fees += moved;
    } else {
      held.count += 1;
    }
    held.perTime = held.count > 0 ? Math.round((held.amount - held.fees) / held.count) : 0;
    if (!held.categoryIds.includes(transaction.categoryId)) {
      held.categoryIds.push(transaction.categoryId);
    }
  }

  return [...totals.values()].sort((left, right) => right.amount - left.amount);
}

export function getPartyMovement(
  transactions: Transaction[],
  counterparties: Counterparty[] = [],
): PartyMovement {
  return {
    out: accumulate(transactions, counterparties, "out"),
    in: accumulate(transactions, counterparties, "in"),
  };
}

export type PartyPriceRise = {
  party: PartyTotal;
  wasPerTime: number;
  nowPerTime: number;
};

// Comparing what one payment costs, not the total, because paying the same shop
// twice as often is not the same as it charging twice as much.
export function findPartyPriceRises(
  transactions: Transaction[],
  previousTransactions: Transaction[],
  counterparties: Counterparty[] = [],
  minimumRise = 0.2,
): PartyPriceRise[] {
  const before = new Map(
    getPartyMovement(previousTransactions, counterparties).out.map((party) => [party.key, party]),
  );

  return getPartyMovement(transactions, counterparties)
    .out.flatMap((party) => {
      const was = before.get(party.key);
      if (!was || was.perTime <= 0 || party.perTime <= 0) return [];
      if (party.perTime <= was.perTime * (1 + minimumRise)) return [];
      return [{ party, wasPerTime: was.perTime, nowPerTime: party.perTime }];
    })
    .sort((left, right) => right.party.amount - left.party.amount);
}

// Nothing here looks worth noticing on its own. The total does.
export function findSmallButAddsUp(
  transactions: Transaction[],
  counterparties: Counterparty[] = [],
  maxPerTime = 10_000,
  minimumTimes = 5,
): PartyTotal[] {
  return getPartyMovement(transactions, counterparties).out.filter(
    (party) =>
      party.count >= minimumTimes && party.perTime > 0 && party.perTime <= maxPerTime,
  );
}
