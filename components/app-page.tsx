import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AppPageProps = {
  children: ReactNode;
  className?: string;
};

type AppHeroCardProps = {
  badge?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
  contentClassName?: string;
  asideClassName?: string;
};

type AppSectionHeadingProps = {
  title: string;
  description?: string;
};

export function AppPage({ children, className }: AppPageProps) {
  return <div className={cn("grid gap-6", className)}>{children}</div>;
}

export function AppHeroCard({
  badge,
  title,
  description,
  actions,
  aside,
  className,
  contentClassName,
  asideClassName,
}: AppHeroCardProps) {
  return (
    <Card
      className={cn(
        "bg-background shadow-none",
        "rounded-none border-0 py-0 ring-0 sm:py-4",
        className,
      )}
    >
      <CardContent
        className={cn(
          "grid gap-6 p-0 sm:p-6 lg:grid-cols-[1.4fr_0.9fr] lg:p-8",
          contentClassName,
        )}
      >
        <div className="space-y-5">
          {badge ? (
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">{badge}</Badge>
          ) : null}
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {description}
            </p>
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        {aside ? (
          <Card className={cn("bg-muted/35 shadow-none", asideClassName)}>
            <CardContent className="p-0">{aside}</CardContent>
          </Card>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AppSectionHeading({ title, description }: AppSectionHeadingProps) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}
