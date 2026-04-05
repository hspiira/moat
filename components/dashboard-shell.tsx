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
import type { AppSection, Milestone, ProductHighlight } from "@/lib/types";

type DashboardShellProps = {
  sections: AppSection[];
  milestones: Milestone[];
  highlights: ProductHighlight[];
};

export function DashboardShell({
  sections,
  milestones,
  highlights,
}: DashboardShellProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf7f2_0%,#f2ebdf_46%,#ebe2d3_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <Card className="overflow-hidden border-border/70 bg-background/95 shadow-lg shadow-primary/5">
          <CardContent className="grid gap-6 p-0 lg:grid-cols-[1.5fr_0.9fr]">
            <div className="space-y-6 px-6 py-8 sm:px-8 sm:py-10">
              <div className="space-y-4">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
                  Uganda-First Finance
                </Badge>
                <div className="space-y-4">
                  <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                    Track. Decide. Build your moat.
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                    This scaffold turns the product blueprint into a live starting
                    point for a mobile-first personal finance app shaped around
                    Ugandan money behavior, savings discipline, and explainable
                    investment guidance.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href="#modules">View modules</a>
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
                  Build useful money habits first
                </CardTitle>
                <CardDescription className="text-sm leading-7">
                  Keep version one practical, local, and explainable before chasing
                  integrations or speculation-heavy features.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      Make money tracking practical with manual entry and CSV
                      import.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      Turn monthly reporting into clear next actions and savings
                      goals.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      Teach safer local investment pathways without becoming a
                      hype machine.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      Preserve a clean technical foundation for future sync and
                      persistence.
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <section className="space-y-6" id="modules">
          <SectionTitle
            eyebrow="Product Surface"
            title="Core modules ready to build out"
            description="These sections mirror the product blueprint and PRD so design, engineering, and content work can move in parallel without losing the Uganda-first framing."
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
            description="The roadmap stays grounded in execution: establish the product truth, build the domain model, ship a usable MVP, then validate with real Ugandan users."
          />
          <Separator />
          <MilestoneList milestones={milestones} />
        </section>

        <Card className="border-dashed border-border/80 bg-background/70 shadow-none">
          <CardContent className="px-6 py-5 text-sm leading-7 text-muted-foreground">
            Start implementation from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              /docs
            </code>
            , then evolve this scaffold into routed pages for transactions,
            accounts, goals, Investment Compass, and Learn Uganda. Keep finance
            rules in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              /lib
            </code>{" "}
            and UI composition in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              /components
            </code>
            .
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
