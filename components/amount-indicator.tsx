import type { ReactNode } from "react";

import {
  IconArrowsLeftRight,
  IconArrowDownRight,
  IconArrowUpRight,
  IconMinus,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export type AmountTone = "positive" | "negative" | "neutral";
export type AmountDirection = "up" | "down" | "flat" | "transfer";
export type AmountSign = "positive" | "negative" | "none";

const toneClasses: Record<AmountTone, string> = {
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-red-700 dark:text-red-400",
  neutral: "text-foreground",
};

const directionIcons = {
  up: IconArrowUpRight,
  down: IconArrowDownRight,
  flat: IconMinus,
  transfer: IconArrowsLeftRight,
} as const;

type AmountIndicatorProps = {
  value: ReactNode;
  tone: AmountTone;
  direction?: AmountDirection;
  sign?: AmountSign;
  showIcon?: boolean;
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
};

export function AmountIndicator({
  value,
  tone,
  direction,
  sign = "none",
  showIcon = false,
  className,
  valueClassName,
  iconClassName,
}: AmountIndicatorProps) {
  const IconComponent = showIcon && direction ? directionIcons[direction] : null;
  const signPrefix = sign === "positive" ? "+" : sign === "negative" ? "-" : "";
  const normalizedValue =
    typeof value === "string" ? value.replace(/^[+\-\u2212]\s*/, "") : value;

  return (
    <span className={cn("inline-flex items-center gap-1.5", toneClasses[tone], className)}>
      {IconComponent ? (
        <IconComponent className={cn("h-4 w-4 shrink-0", iconClassName)} aria-hidden="true" />
      ) : null}
      <span className={cn("tabular-nums", valueClassName)}>
        {signPrefix}
        {normalizedValue}
      </span>
    </span>
  );
}
