import Link from "next/link";

import { FeatureCard } from "@/components/feature-card";
import { MilestoneList } from "@/components/milestone-list";
import { SectionTitle } from "@/components/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type {
  AppSection,
  Milestone,
  ModulePreview,
  ProductHighlight,
} from "@/lib/types";

type HomeOverviewProps = {
  sections: AppSection[];
  milestones: Milestone[];
  highlights: ProductHighlight[];
  modulePreviews: ModulePreview[];
};

export function HomeOverview({
  sections,
  milestones,
  highlights,
  modulePreviews,
}: HomeOverviewProps) {
  return (
    <>
      <Card className="overflow-hidden border-border/70 bg-background/95 shadow-lg shadow-primary/5">
        <CardContent className="grid gap-6 p-0 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-6 px-6 py-8 sm:px-8 sm:py-10">
            <div className="space-y-4">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
                Delivery baseline
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  Track. Decide. Build your moat.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                  The app has moved past a single landing screen. Issue #2 now
                  establishes the route map and shared shell that later work will
                  build on.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/accounts">Open routed sections</Link>
              </Button>
              <Button asChild variant="outline">
                <a href="#roadmap">Review roadmap</a>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((highlight) => (
                <Card
                  className="border-border/70 bg-muted/50 shadow-none"
                  key={highlight.label}
                  size="sm"
                >
                  <CardHeader className="space-y-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      {highlight.label}
                    </CardDescription>
                    <CardTitle className="text-sm leading-6 font-medium">
                      {highlight.value}
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
          <Card className="m-4 border-border/70 bg-primary/5 shadow-none">
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit bg-background/70">
                MVP north star
              </Badge>
              <CardTitle className="text-2xl">
                Keep the first release operationally simple
              </CardTitle>
              <CardDescription className="text-sm leading-7">
                Routing exists now because the next issues need stable surfaces,
                not because the product is feature-complete.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Manual entry and CSV import stay the v1 data strategy.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Each route now maps cleanly to an issue and milestone.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Finance logic remains separate from route presentation.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Later work can fill in flows without reorganizing the app.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <section className="space-y-6">
        <SectionTitle
          eyebrow="Product Surface"
          title="Route-level modules"
          description="Each module now has its own URL and implementation surface, which is the main outcome required for issue #2."
        />
        <Separator />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {modulePreviews.map((module) => (
            <Card key={module.href} className="border-border/70 bg-background/90">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">{module.stage}</Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={module.href}>Open</Link>
                  </Button>
                </div>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription className="leading-7">
                  {module.summary}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionTitle
          eyebrow="Specification"
          title="Core modules ready to build out"
          description="The route shell still stays aligned with the blueprint and PRD, so the information architecture reflects product intent."
        />
        <Separator />
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <FeatureCard
              key={section.id}
              title={section.title}
              summary={section.summary}
              bullets={section.bullets}
            />
          ))}
        </div>
      </section>

      <section className="space-y-6" id="roadmap">
        <SectionTitle
          eyebrow="Delivery Plan"
          title="Implementation milestones"
          description="The route refactor is now in place. The next issues can focus on building behavior into these surfaces."
        />
        <Separator />
        <MilestoneList milestones={milestones} />
      </section>

      <Card className="border-dashed border-border/80 bg-background/70 shadow-none">
        <CardContent className="px-6 py-5 text-sm leading-7 text-muted-foreground">
          Issue #2 is satisfied when route structure, shared navigation, and
          section-specific placeholders are stable. Interactive flows remain the
          responsibility of later issues.
        </CardContent>
      </Card>
    </>
  );
}
