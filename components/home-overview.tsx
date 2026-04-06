import Link from "next/link";

import {
  AppAsideIntro,
  AppHeroCard,
  AppPage,
  AppSectionHeading,
} from "@/components/app-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ModulePreview } from "@/lib/types";

type HomeOverviewProps = {
  modulePreviews: ModulePreview[];
};

export function HomeOverview({ modulePreviews }: HomeOverviewProps) {
  return (
    <AppPage>
      <AppHeroCard
        className="border-border/20"
        title="Track clearly. Save deliberately. Invest with rules."
        description="A personal finance tool for Uganda that keeps cash, mobile money, bank, SACCO, and long-term goals in one simple operating view."
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
            title="Built for how money moves locally"
            description="One clean system for tracking, building buffers, and choosing safer next steps."
            headerClassName="pb-2"
            contentClassName="pb-0"
          >
            <div className="grid gap-5">
              <div className="flex items-start gap-4">
                <div className="moat-pie aspect-square w-14 shrink-0 sm:w-20 md:w-28" />
                <div className="grid gap-4">
                  <div className="grid gap-1">
                    <div className="text-4xl font-semibold tracking-tight">3</div>
                    <p className="text-sm text-muted-foreground">Track, decide, automate</p>
                  </div>
                  <div className="text-sm leading-6 text-muted-foreground">
                    Emergency fund first. Investment guidance second.
                  </div>
                </div>
              </div>
              <Separator className="bg-border/50" />
              <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
                {[
                  "Track spending across cash, mobile money, and bank accounts",
                  "Build an emergency fund before taking on investment risk",
                  "Import MTN or bank statements via CSV",
                ].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </AppAsideIntro>
        }
        asideClassName="gap-0 bg-transparent py-0 ring-0"
      />

      <section className="grid gap-4">
        <AppSectionHeading
          title="How the product stays simple"
          description="One accent block, one clear list, one next action."
        />
        <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
          <Card className="moat-panel-yellow border-border/20 shadow-none">
            <CardContent className="grid gap-6 p-5">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/70">
                  Track
                </div>
                <div className="text-4xl font-semibold tracking-tight">Cash flow</div>
              </div>
              <div className="grid gap-2 text-sm text-foreground/80">
                <div>See what came in.</div>
                <div>See what went out.</div>
                <div>See what should change next month.</div>
              </div>
            </CardContent>
          </Card>

          <Card className="moat-panel-lilac border-border/20 shadow-none">
            <CardContent className="grid gap-4 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/70">
                Save
              </div>
              <div className="text-3xl font-semibold tracking-tight">Emergency first</div>
              <p className="text-sm leading-6 text-foreground/80">
                Build a rent or school-fees buffer before stretching into long-term risk.
              </p>
            </CardContent>
          </Card>

          <Card className="moat-panel-mint border-border/20 shadow-none">
            <CardContent className="grid gap-4 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/70">
                Decide
              </div>
              <div className="text-3xl font-semibold tracking-tight">Rule-based guidance</div>
              <p className="text-sm leading-6 text-foreground/80">
                Match your horizon and liquidity needs to safer product classes in Uganda.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4">
        <AppSectionHeading title="Explore the product" description="Every screen has one main job." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modulePreviews.map((module, index) => {
            const toneClass =
              index % 3 === 0
                ? "moat-panel-yellow"
                : index % 3 === 1
                  ? "moat-panel-sage"
                  : "moat-panel-mint";

            return (
              <Card key={module.href} className={`${toneClass} border-border/20 shadow-none`}>
                <CardContent className="p-0">
                  <Button
                    asChild
                    variant="ghost"
                    className="h-auto w-full items-start justify-start px-4 py-5 text-left"
                  >
                    <Link href={module.href}>
                      <span className="block">
                        <span className="block text-[11px] uppercase tracking-[0.18em] text-foreground/65">
                          {module.stage}
                        </span>
                        <span className="mt-2 block text-lg font-semibold text-foreground">
                          {module.title}
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-foreground/75">
                          {module.summary}
                        </span>
                      </span>
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </AppPage>
  );
}
