import Link from "next/link";

import {
  AppAsideIntro,
  AppHeroCard,
  AppPage,
  AppSectionHeading,
} from "@/components/app-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ModulePreview } from "@/lib/types";

type HomeOverviewProps = {
  modulePreviews: ModulePreview[];
};

export function HomeOverview({ modulePreviews }: HomeOverviewProps) {
  return (
    <AppPage>
      <AppHeroCard
        title="Track your money. Build your financial moat."
        description="A personal finance tool built for Uganda. Track income and expenses across mobile money, cash, and bank accounts. Set goals, build emergency savings, and get rule-based investment guidance."
        actions={
          <>
            <Button asChild>
              <Link href="/onboarding">Get started</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/learn">Learn Uganda finance</Link>
            </Button>
          </>
        }
        aside={
          <AppAsideIntro
            title="What Moat does"
            description="Built for how money actually works in Uganda."
          >
            <div className="p-6 pt-0">
              <ul className="grid gap-2.5 text-sm leading-6 text-muted-foreground">
                {[
                  "Track spending across cash, mobile money, and bank accounts",
                  "Understand your monthly cash flow without complex setup",
                  "Build an emergency fund before taking on investment risk",
                  "Get guidance matched to your time horizon — not stock tips",
                  "Import MTN or bank statements via CSV",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AppAsideIntro>
        }
      />

      <section className="grid gap-4">
        <AppSectionHeading
          title="Sections"
          description="Explore the app structure without completing setup."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modulePreviews.map((module) => (
            <Card key={module.href} className="border-border/30 bg-muted/30 shadow-none">
              <CardContent className="p-0">
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto w-full items-start justify-start rounded-[inherit] px-4 py-4 text-left"
                >
                  <Link href={module.href}>
                    <span className="block">
                      <span className="block text-sm font-medium text-foreground">
                        {module.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {module.summary}
                      </span>
                    </span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppPage>
  );
}
