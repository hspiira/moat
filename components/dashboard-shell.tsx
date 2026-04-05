import { FeatureCard } from "@/components/feature-card";
import { MilestoneList } from "@/components/milestone-list";
import { SectionTitle } from "@/components/section-title";
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
    <main className="page-shell">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">Uganda-First Finance</span>
            <h1>Track. Decide. Build your moat.</h1>
            <p>
              This scaffold turns the product blueprint into a live starting point:
              a mobile-first personal finance app shaped around Ugandan money
              behavior, goal-driven saving, and explainable investment guidance.
            </p>
            <div className="highlight-grid">
              {highlights.map((highlight) => (
                <div className="highlight-chip" key={highlight.label}>
                  <strong>{highlight.label}</strong>
                  <span>{highlight.value}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="summary-panel">
            <h2>MVP north star</h2>
            <ul>
              <li>Make money tracking practical with manual entry and CSV import.</li>
              <li>Turn monthly reporting into real next actions and savings goals.</li>
              <li>Teach safer local investment pathways without becoming a hype machine.</li>
              <li>Preserve a clean technical foundation for future sync and persistence.</li>
            </ul>
          </aside>
        </div>
      </section>

      <div className="section-stack">
        <section>
          <SectionTitle
            eyebrow="Product Surface"
            title="Core modules ready to build out"
            description="These sections mirror the product blueprint and PRD so design, engineering, and content work can move in parallel without losing the Uganda-first framing."
          />
          <div className="card-grid">
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

        <section>
          <SectionTitle
            eyebrow="Delivery Plan"
            title="Implementation milestones"
            description="The roadmap stays grounded in execution: establish the product truth, build the domain model, ship a usable MVP, then validate with real Ugandan users."
          />
          <MilestoneList milestones={milestones} />
        </section>
      </div>

      <section className="footer-note">
        Start implementation from the docs in <code>/docs</code>, then evolve this
        scaffold into routed pages for transactions, accounts, goals, Investment
        Compass, and Learn Uganda. Keep finance rules in <code>/lib</code> and UI
        composition in <code>/components</code>.
      </section>
    </main>
  );
}
