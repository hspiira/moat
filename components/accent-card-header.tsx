import type { ReactNode } from "react";

import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AccentCardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function AccentCardHeader({
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
}: AccentCardHeaderProps) {
  return (
    <CardHeader className={cn("gap-1 bg-muted/40 py-4 text-foreground", className)}>
      <CardTitle className={cn("text-lg text-foreground", titleClassName)}>{title}</CardTitle>
      {description ? (
        <CardDescription
          className={cn("leading-6 text-muted-foreground", descriptionClassName)}
        >
          {description}
        </CardDescription>
      ) : null}
    </CardHeader>
  );
}
