import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className={cn("border-border/20 bg-background shadow-none", className)}>
      <CardContent
        className={cn(
          "grid gap-6 p-6 lg:grid-cols-[1.4fr_0.9fr] lg:p-8",
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
          <Card className={cn("border-border/20 bg-muted/35 shadow-none", asideClassName)}>
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

export function AppAsideIntro({
  badge,
  title,
  description,
  children,
  headerClassName,
  contentClassName,
}: {
  badge?: string;
  title: string;
  description: string;
  children: ReactNode;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <>
      <CardHeader className={cn("space-y-3", headerClassName)}>
        {badge ? (
          <Badge variant="outline" className="w-fit bg-background/70">
            {badge}
          </Badge>
        ) : null}
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </>
  );
}
