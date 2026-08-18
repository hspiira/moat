import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { SupportedCurrency } from "@/lib/types";

type MoneyTone = "auto" | "positive" | "negative" | "warning" | "neutral" | "muted";

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
    warning: "text-clay",
    neutral: "text-foreground",
    muted: "text-muted-foreground",
  }[resolvedTone];

  const magnitude = formatMoney(Math.abs(amount), currency);
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
    signed && resolvedTone === "positive"
      ? " in"
      : signed && resolvedTone === "negative"
        ? " out"
        : "";

  return (
    <span
      className={cn(
        "tabular-nums tracking-tight wrap-anywhere",
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
