import {
  buildCounterparty,
  counterpartyMatchKey,
  findCounterpartyByName,
} from "@/lib/domain/counterparties";
import { partyKeyOf } from "@/lib/domain/party-totals";
import type { Counterparty, CounterpartyNature, Transaction } from "@/lib/types";

export type NamedPartyPlan = {
  counterparty: Counterparty;
  isNew: boolean;
  transactions: Transaction[];
};

export type NamePartyRequest = {
  // The grouping key from the report, which is the payee text as it stands.
  partyKey: string;
  name: string;
  nature: CounterpartyNature;
  transactions: Transaction[];
  existing: Counterparty[];
  userId: string;
  timestamp: string;
  id: string;
};

export function planNamedParty(request: NamePartyRequest): NamedPartyPlan | null {
  const name = request.name.trim();
  if (!name || !request.partyKey) return null;

  // Naming a second spelling the same thing folds it into the party already
  // there, so merging two spellings is just naming them both.
  const match = findCounterpartyByName(request.existing, name);
  const counterparty: Counterparty = match
    ? { ...match, nature: match.nature ?? request.nature, updatedAt: request.timestamp }
    : {
        ...buildCounterparty({
          id: request.id,
          userId: request.userId,
          name,
          kind: "none",
          timestamp: request.timestamp,
        }),
        nature: request.nature,
      };

  // partyKeyOf prefers counterpartyId, so a row belonging to another party can
  // never match a key read off payee text. Matching on the key alone therefore
  // both protects those rows and lets an already-named party be renamed.
  const claimed = request.transactions.filter(
    (transaction) => partyKeyOf(transaction) === request.partyKey,
  );

  if (claimed.length === 0 && match) return null;

  return {
    counterparty,
    isNew: !match,
    transactions: claimed.map((transaction) => ({
      ...transaction,
      counterpartyId: counterparty.id,
      updatedAt: request.timestamp,
    })),
  };
}

export function isNamedPartyKey(partyKey: string): boolean {
  return partyKey.startsWith("party:");
}

export function suggestedPartyName(partyKey: string, transactions: Transaction[]): string {
  const row = transactions.find((transaction) => partyKeyOf(transaction) === partyKey);
  const raw = row?.payee ?? row?.rawPayee ?? "";
  return counterpartyMatchKey(raw) ? raw.trim() : "";
}
