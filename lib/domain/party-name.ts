import type { Counterparty, Transaction } from "@/lib/types";

type Named = Pick<Transaction, "counterpartyId" | "payee" | "rawPayee" | "transferGroupId">;

export function partyByTransferGroup(transactions: Transaction[]): Map<string, string> {
  const byGroup = new Map<string, string>();

  for (const transaction of transactions) {
    const { transferGroupId, counterpartyId } = transaction;
    if (!transferGroupId || !counterpartyId || byGroup.has(transferGroupId)) continue;
    byGroup.set(transferGroupId, counterpartyId);
  }

  return byGroup;
}

export function partyNameFor(
  transaction: Named,
  counterparties: Map<string, Counterparty>,
  partyByGroup?: Map<string, string>,
): string | undefined {
  const counterpartyId =
    transaction.counterpartyId ??
    (transaction.transferGroupId ? partyByGroup?.get(transaction.transferGroupId) : undefined);

  const party = counterpartyId ? counterparties.get(counterpartyId) : undefined;

  return party?.name ?? transaction.payee ?? transaction.rawPayee;
}

export function counterpartiesById(counterparties: Counterparty[]): Map<string, Counterparty> {
  return new Map(counterparties.map((entry) => [entry.id, entry]));
}
