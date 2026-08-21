import type {
  Item,
  ItemPriceSummary,
  PriceObservation,
  Transaction,
  TransactionLineItem,
} from "@/lib/types";

export function derivePriceObservations(
  lineItems: TransactionLineItem[],
  transactions: Transaction[],
): PriceObservation[] {
  const transactionsById = new Map(transactions.map((entry) => [entry.id, entry]));
  const observations: PriceObservation[] = [];
  for (const line of lineItems) {
    if (!line.itemId) continue;
    const transaction = transactionsById.get(line.transactionId);
    if (!transaction) continue;
    observations.push({
      itemId: line.itemId,
      transactionId: transaction.id,
      lineItemId: line.id,
      merchant: transaction.payee ?? "Unknown",
      occurredOn: transaction.occurredOn,
      unitPrice: line.unitPrice,
      amount: line.amount,
      quantity: line.quantity,
    });
  }
  return observations;
}

function recentCutoff(today: string): string {
  const [year, rest] = [Number(today.slice(0, 4)) - 1, today.slice(4)];
  return `${year}${rest}`;
}

function pricePoint(observation: PriceObservation): number | undefined {
  if (observation.unitPrice != null) return observation.unitPrice;
  if (observation.amount == null) return undefined;
  return observation.amount / (observation.quantity ?? 1);
}

export function summarizeItemPrices(
  observations: PriceObservation[],
  today: string,
): Map<string, ItemPriceSummary> {
  const cutoff = recentCutoff(today);
  const summaries = new Map<string, ItemPriceSummary>();
  for (const observation of observations) {
    const summary = summaries.get(observation.itemId) ?? {
      itemId: observation.itemId,
      observationCount: 0,
    };
    summary.observationCount += 1;
    if (!summary.lastPaid || observation.occurredOn > summary.lastPaid.occurredOn) {
      summary.lastPaid = observation;
    }
    const price = pricePoint(observation);
    if (price != null && observation.occurredOn >= cutoff) {
      const bestPrice = summary.bestRecent ? pricePoint(summary.bestRecent) : undefined;
      if (bestPrice == null || price < bestPrice) {
        summary.bestRecent = observation;
      }
    }
    summaries.set(observation.itemId, summary);
  }
  return summaries;
}

export type PriceRise = {
  itemId: string;
  name: string;
  paidNow: number;
  paidBefore: number;
  rise: number;
  before: PriceObservation;
  now: PriceObservation;
};

// What an item costs now against the cheapest it has recently been. Comparing
// against the cheapest rather than the previous purchase is deliberate: a price
// that crept up over three shops never shows a jump between any two of them.
export function findPriceRises(params: {
  items: Item[];
  lineItems: TransactionLineItem[];
  transactions: Transaction[];
  today: string;
}): PriceRise[] {
  const names = new Map(params.items.map((item) => [item.id, item.name]));
  const summaries = summarizeItemPrices(
    derivePriceObservations(params.lineItems, params.transactions),
    params.today,
  );

  const rises: PriceRise[] = [];

  for (const summary of summaries.values()) {
    const { lastPaid, bestRecent } = summary;
    if (!lastPaid || !bestRecent || lastPaid.lineItemId === bestRecent.lineItemId) continue;

    const paidNow = pricePoint(lastPaid);
    const paidBefore = pricePoint(bestRecent);
    if (paidNow == null || paidBefore == null || paidNow <= paidBefore) continue;

    rises.push({
      itemId: summary.itemId,
      name: names.get(summary.itemId) ?? "An item",
      paidNow,
      paidBefore,
      rise: paidNow - paidBefore,
      before: bestRecent,
      now: lastPaid,
    });
  }

  return rises.sort((left, right) => right.rise - left.rise);
}
