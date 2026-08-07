import type {
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

/** ISO date 12 months before `today`, for the bestRecent window. */
function recentCutoff(today: string): string {
  const [year, rest] = [Number(today.slice(0, 4)) - 1, today.slice(4)];
  return `${year}${rest}`;
}

function pricePoint(observation: PriceObservation): number | undefined {
  return observation.unitPrice ?? observation.amount;
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
