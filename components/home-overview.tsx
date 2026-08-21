import Link from "next/link";
import {
  IconBuildingBank,
  IconBusinessplan,
  IconChevronRight,
  IconSchool,
  IconTransfer,
  type Icon,
} from "@tabler/icons-react";

import { AppSectionHeading } from "@/components/app-page";
import { Button } from "@/components/ui/button";
import type { ModulePreview } from "@/lib/types";

type HomeOverviewProps = {
  modulePreviews: ModulePreview[];
};

const moduleIcons: Record<string, Icon> = {
  "/accounts": IconBuildingBank,
  "/transactions": IconTransfer,
  "/goals": IconBusinessplan,
  "/learn": IconSchool,
};

const principles = [
  {
    eyebrow: "Track",
    title: "Cash flow",
    body: "See what came in, what went out, and what should change next month.",
  },
  {
    eyebrow: "Save",
    title: "Emergency first",
    body: "Build a rent or school-fees buffer before stretching into long-term risk.",
  },
  {
    eyebrow: "Decide",
    title: "Rule-based guidance",
    body: "Match your horizon and liquidity needs to safer product classes in Uganda.",
  },
] as const;

export function HomeOverview({ modulePreviews }: HomeOverviewProps) {
  return (
    <div className="grid gap-10 sm:gap-12">
      <section className="grid gap-5 pt-1">
        <div className="grid gap-3">
          <h1 className="max-w-3xl font-display text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Track clearly. Save deliberately. Invest with rules.
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            A personal finance tool for Ugandans that keeps cash, mobile money, bank, SACCO, and
            long-term goals in one simple operating view.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/onboarding">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/learn">Learn Uganda finance</Link>
          </Button>
        </div>

        <ul className="grid gap-2 text-sm leading-6 text-muted-foreground">
          {[
            "Works offline — your records stay on this device",
            "Import MTN or bank statements via CSV",
            "Locked behind a PIN, encrypted at rest",
          ].map((item) => (
            <li key={item} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-2.5 size-1 shrink-0 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <AppSectionHeading
          title="How the product stays simple"
          description="One thing to do first, then two that follow from it."
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {principles.map((principle, index) => {
            const isLead = index === 0;

            return (
              <div
                key={principle.title}
                className={[
                  "grid content-start gap-2 rounded-xl p-5",
                  isLead
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-card-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[0.7rem] font-medium",
                    isLead ? "text-primary-foreground/75" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {principle.eyebrow}
                </span>
                <span className="font-display text-xl font-semibold tracking-tight">
                  {principle.title}
                </span>
                <span
                  className={[
                    "text-sm leading-6",
                    isLead ? "text-primary-foreground/85" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {principle.body}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3">
        <AppSectionHeading
          title="Explore the product"
          description="Every screen has one main job."
        />
        <ul className="grid overflow-hidden rounded-xl">
          {modulePreviews.map((module, index) => {
            const IconComponent = moduleIcons[module.href];

            return (
              <li
                key={module.href}
                className={index > 0 ? "" : undefined}
              >
                <Link
                  href={module.href}
                  className="flex items-start gap-4 py-4 transition-colors hover:bg-muted/50 sm:px-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {IconComponent ? <IconComponent className="size-5" /> : null}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex min-h-10 items-center font-medium text-foreground">
                      {module.title}
                    </span>
                    <span className="text-sm leading-6 text-muted-foreground">
                      {module.summary}
                    </span>
                  </span>
                  <IconChevronRight
                    aria-hidden="true"
                    className="mt-3 size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
