import type { ReactNode } from "react";

import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const accentToneClasses = {
  yellow: "moat-panel-yellow",
  lilac: "moat-panel-lilac",
  mint: "moat-panel-mint",
  sage: "moat-panel-sage",
} as const;

export type AccentTone = keyof typeof accentToneClasses;

type AccentCardHeaderProps = {
  tone: AccentTone;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function AccentCardHeader({
  tone,
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
}: AccentCardHeaderProps) {
  return (
    <CardHeader
      className={cn(
        accentToneClasses[tone],
        "min-h-20 gap-1 border-b border-border/20 py-3 text-foreground",
        className,
      )}
    >
      <CardTitle className={cn("text-lg text-foreground", titleClassName)}>
        {title}
      </CardTitle>
      {description ? (
        <CardDescription className={cn("text-foreground/72 leading-6", descriptionClassName)}>
          {description}
        </CardDescription>
      ) : null}
    </CardHeader>
  );
}
