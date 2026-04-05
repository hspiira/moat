import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ModulePreview } from "@/lib/types";

type HomeOverviewProps = {
  modulePreviews: ModulePreview[];
};

/**
 * Render the home page overview, including a hero card with CTAs and a grid of module preview links.
 *
 * @param modulePreviews - Array of module preview items; each item is expected to include `href`, `title`, and `summary`
 * @returns The React element for the Home overview UI
 */
export function HomeOverview({ modulePreviews }: HomeOverviewProps) {
  return (
    <div className="grid gap-6">
      <Card className="border-border/40 shadow-none">
        <CardContent className="grid gap-6 p-0 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-5 px-6 py-8 sm:px-8 sm:py-10">
            <div className="space-y-3">
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                Track your money. Build your financial moat.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                A personal finance tool built for Uganda. Track income and expenses across
                mobile money, cash, and bank accounts. Set goals, build emergency savings,
                and get rule-based investment guidance.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/onboarding">Get started</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/learn">Learn Uganda finance</Link>
              </Button>
            </div>
          </div>

          <Card className="m-4 border-border/40 bg-muted/30 shadow-none">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">What Moat does</CardTitle>
              <CardDescription className="leading-6">
                Built for how money actually works in Uganda.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium text-foreground">Sections</h2>
          <p className="text-xs text-muted-foreground">Explore without an account.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modulePreviews.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-md border border-border/40 bg-muted/30 px-4 py-4 transition-colors hover:border-border/70 hover:bg-muted/50"
            >
              <div className="text-sm font-medium text-foreground">{module.title}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
