import { estimateBasis } from "@/components/shopping/estimate-basis";
import { Money } from "@/components/ui/money";
import type { PlannedEstimate } from "@/lib/domain/planned-purchases";
import { shoppingSummaryNotes } from "@/lib/domain/shopping-summary";

/**
 * One number answers this page: what the shopping still to do will cost. It is
 * the headline, and everything else is an aside under it.
 *
 * Three tiles of equal weight made none of them the answer, and on a phone they
 * stack, so a tile reading zero cost a third of the first screen to say nothing.
 */
export function ShoppingSummary({
  plannedAmount,
  boughtAmount,
  boughtCount,
  basis,
}: {
  plannedAmount: number;
  boughtAmount: number;
  boughtCount: number;
  basis: PlannedEstimate;
}) {
  const notes = shoppingSummaryNotes({
    basis: estimateBasis(basis),
    boughtCount,
    boughtAmount,
  });

  return (
    <section aria-label="Shopping summary" className="grid gap-1">
      <p className="text-sm text-muted-foreground">Still to buy</p>
      <div className="font-display text-[clamp(2.25rem,10vw,3rem)] leading-[1.1] font-semibold tracking-tight">
        <Money amount={plannedAmount} tone="neutral" className="font-display" />
      </div>
      {notes.length > 0 ? (
        <p className="text-sm text-muted-foreground">{notes.join(" · ")}</p>
      ) : null}
    </section>
  );
}
