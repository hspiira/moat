import Link from "next/link";

import { AppAsideIntro, AppHeroCard, AppPage } from "@/components/app-page";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ModuleDetail } from "@/lib/types";

type ModulePageProps = {
  detail: ModuleDetail;
};

export function ModulePage({ detail }: ModulePageProps) {
  return (
    <AppPage>
      <AppHeroCard
        badge={detail.eyebrow}
        title={detail.title}
        description={detail.description}
        actions={
          <>
            <Button asChild>
              <Link href={detail.primaryCta.href}>{detail.primaryCta.label}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={detail.secondaryCta.href}>{detail.secondaryCta.label}</Link>
            </Button>
          </>
        }
        aside={
          <AppAsideIntro
            badge="Route intent"
            title={detail.intentTitle}
            description={detail.intentSummary}
          >
            <div className="p-6 pt-0">
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                {detail.intentBullets.map((bullet) => (
                  <li className="flex gap-2" key={bullet}>
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AppAsideIntro>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle>Current implementation scope</CardTitle>
            <CardDescription className="leading-7">
              This route is intentionally structured for the issue sequence already
              on the project board.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.scopeGroups.map((group) => (
              <div className="space-y-3" key={group.title}>
                <div>
                  <h2 className="text-base font-medium">{group.title}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {group.summary}
                  </p>
                </div>
                <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                  {group.items.map((item) => (
                    <li className="flex gap-2" key={item}>
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Separator />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle>Acceptance gates</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                {detail.acceptanceGates.map((gate) => (
                  <li className="flex gap-2" key={gate}>
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{gate}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-dashed border-border/80 bg-background/70 shadow-none">
            <CardHeader>
              <CardTitle>Linked issue</CardTitle>
              <CardDescription>{detail.issueSummary}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                GitHub issue #{detail.issueNumber}
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={detail.issueHref} target="_blank" rel="noreferrer">
                  Open issue
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppPage>
  );
}
