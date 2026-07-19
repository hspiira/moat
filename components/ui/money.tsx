import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { SupportedCurrency } from "@/lib/types";

type MoneyTone = "auto" | "positive" | "negative" | "neutral" | "muted";

/**
 * Renders a currency amount with tabular figures and money-semantic color.
 *
 * Sign is conveyed by more than color: a leading +/- glyph plus an
 * sr-only "in"/"out" word, so the meaning survives for color-blind and
 * screen-reader users (WCAG 1.4.1).
 */
export function Money({
  amount,
  currency = "UGX",
  tone = "neutral",
  signed = false,
  className,
}: {
  amount: number;
  currency?: SupportedCurrency;
  tone?: MoneyTone;
  signed?: boolean;
  className?: string;
}) {
  const resolvedTone: Exclude<MoneyTone, "auto"> =
    tone === "auto" ? (amount > 0 ? "positive" : amount < 0 ? "negative" : "neutral") : tone;

  const toneClass = {
    positive: "text-pos",
    negative: "text-neg",
    neutral: "text-foreground",
    muted: "text-muted-foreground",
  }[resolvedTone];

  const magnitude = formatMoney(Math.abs(amount), currency);
  // Sign expresses money direction, which the tone already encodes — so an
  // outflow stored as a positive number still reads as "−". Fall back to the
  // raw value's sign only when the tone is neutral/auto.
  const sign =
    resolvedTone === "positive"
      ? "+"
      : resolvedTone === "negative"
        ? "−"
        : amount > 0
          ? "+"
          : amount < 0
            ? "−"
            : "";
  const srDirection =
    resolvedTone === "positive" ? " in" : resolvedTone === "negative" ? " out" : "";

  return (
    // Intl money strings join currency and digits with no-break spaces, so
    // without an escape hatch they overflow tight cards instead of wrapping.
    // overflow-wrap:anywhere lets them break as a last resort.
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight wrap-anywhere",
        toneClass,
        className,
      )}
    >
      {signed && sign ? <span aria-hidden>{sign}</span> : null}
      {magnitude}
      {srDirection ? <span className="sr-only">{srDirection}</span> : null}
    </span>
  );
}
