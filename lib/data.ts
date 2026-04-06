import type {
  AppSection,
  Milestone,
  ModuleDetail,
  ModulePreview,
  NavItem,
  ProductHighlight,
} from "@/lib/types";

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    description: "Monthly overview and spending summary.",
  },
  {
    href: "/accounts",
    label: "Accounts",
    description: "Track cash, mobile money, bank, SACCO, and debt.",
  },
  {
    href: "/transactions",
    label: "Transactions",
    description: "Record income, expenses, transfers, and savings.",
  },
  {
    href: "/goals",
    label: "Goals",
    description: "Emergency fund and savings goal tracking.",
  },
  {
    href: "/investment-compass",
    label: "Compass",
    description: "Rule-based guidance for Uganda investments.",
  },
  {
    href: "/learn",
    label: "Learn",
    description: "Official Uganda finance sources and references.",
  },
];

export const productHighlights: ProductHighlight[] = [
  {
    label: "Audience",
    value: "Young salaried Ugandans with occasional side income",
  },
  {
    label: "MVP Input",
    value: "Manual entry plus CSV import before deep integrations",
  },
  {
    label: "Investment stance",
    value: "Rule-based guidance, not personalized stock picking",
  },
];

export const appSections: AppSection[] = [
  {
    id: "accounts",
    title: "Accounts and balances",
    summary:
      "Track money across the channels people actually use: cash, mobile money, bank accounts, SACCOs, debt, and future investment accounts.",
    bullets: [
      "Manual account setup with opening balances",
      "Support for institution names and notes",
      "Foundation for balance aggregation and reconciliation",
    ],
  },
  {
    id: "transactions",
    title: "Transactions and imports",
    summary:
      "Make data capture practical first. The product starts with manual logging and CSV import rather than betting v1 on fragile connectivity.",
    bullets: [
      "Income, expense, transfer, savings, and debt payment types",
      "Transfer handling to avoid false spending totals",
      "Import preview and duplicate detection in future iterations",
    ],
  },
  {
    id: "goals",
    title: "Goals and emergency fund",
    summary:
      "Tie money behavior to what matters: emergency reserves, rent buffers, land savings, school fees, and business capital.",
    bullets: [
      "Monthly contribution targets",
      "Goal progress tracking",
      "Emergency fund priority before long-term investing",
    ],
  },
  {
    id: "guidance",
    title: "Investment Compass and learning",
    summary:
      "Guide users toward suitable product classes in Uganda using clear rules, official references, and strong scam avoidance language.",
    bullets: [
      "Horizon-based product class guidance",
      "Local sources like BoU, CMA, USE, UMRA, and URBRA",
      "Educational framing without advisory overreach",
    ],
  },
];

export const implementationMilestones: Milestone[] = [
  {
    id: "m1",
    kicker: "Milestone 1",
    title: "Documentation baseline",
    summary:
      "Lock the product truth so design and engineering work from the same Uganda-first assumptions.",
    outputs: [
      "MVP blueprint",
      "PRD",
      "technical architecture and schema direction",
    ],
  },
  {
    id: "m2",
    kicker: "Milestone 2",
    title: "Design and domain model",
    summary:
      "Translate product intent into routes, components, flow states, and a durable financial language.",
    outputs: [
      "wireframes for core screens",
      "category taxonomy",
      "domain types and summary logic",
    ],
  },
  {
    id: "m3",
    kicker: "Milestone 3",
    title: "MVP build",
    summary:
      "Ship the first end-to-end working experience covering onboarding, accounts, transactions, dashboard, goals, and guidance.",
    outputs: [
      "interactive forms",
      "dashboard calculations",
      "goal and guidance flows",
    ],
  },
  {
    id: "m4",
    kicker: "Milestone 4",
    title: "Testing and pilot prep",
    summary:
      "Validate product clarity, local fit, and calculation accuracy before putting it in front of early Ugandan users.",
    outputs: [
      "QA checklist",
      "mobile polish",
      "pilot-ready content and bug fixes",
    ],
  },
];

export const modulePreviews: ModulePreview[] = [
  {
    href: "/accounts",
    title: "Accounts",
    summary: "Track balances across cash, mobile money, bank, SACCO, and debt accounts.",
    stage: "Active",
  },
  {
    href: "/transactions",
    title: "Transactions",
    summary: "Record income, expenses, savings contributions, and transfers.",
    stage: "Active",
  },
  {
    href: "/goals",
    title: "Goals",
    summary: "Set savings targets and track emergency fund progress.",
    stage: "Active",
  },
  {
    href: "/investment-compass",
    title: "Investment Compass",
    summary: "Rule-based guidance matched to your time horizon and liquidity needs.",
    stage: "Active",
  },
  {
    href: "/learn",
    title: "Learn Uganda",
    summary: "Official sources for regulated investing and institution verification.",
    stage: "Active",
  },
];

export const moduleDetails: Record<string, ModuleDetail> = {
  accounts: {
    eyebrow: "Accounts Surface",
    title: "Accounts and balances",
    description:
      "This route exists to isolate account setup from the landing page. The next implementation step is to turn it into a usable balance and account-management workflow.",
    intentTitle: "Why this route exists",
    intentSummary:
      "Issue #2 requires stable routed surfaces. Accounts is the first dependency for onboarding and balance-aware reporting.",
    intentBullets: [
      "Supports cash, mobile money, bank, SACCO, investment, and debt account types.",
      "Gives onboarding a concrete destination instead of leaving setup buried on the home page.",
      "Sets up later balance aggregation and reconciliation work.",
    ],
    primaryCta: {
      href: "/transactions",
      label: "Next: transactions route",
    },
    secondaryCta: {
      href: "/",
      label: "Back to overview",
    },
    scopeGroups: [
      {
        title: "Planned interactions",
        summary: "These are the behaviors later issues should fill into this route.",
        items: [
          "Manual account creation and editing.",
          "Opening balance capture during onboarding.",
          "Institution metadata for bank and SACCO accounts.",
        ],
      },
      {
        title: "Route-level expectations",
        summary: "The page already gives the app a stable information architecture target.",
        items: [
          "Dedicated URL and shell navigation.",
          "Space for account summaries and setup prompts.",
          "No dashboard-only coupling.",
        ],
      },
    ],
    acceptanceGates: [
      "Users can reach account setup from the global shell.",
      "The route is stable enough for onboarding work to target directly.",
      "Account concepts are no longer implied only from documentation.",
    ],
    issueNumber: 4,
    issueHref: "https://github.com/hspiira/moat/issues/4",
    issueSummary: "Build onboarding and account setup flows.",
  },
  transactions: {
    eyebrow: "Transactions Surface",
    title: "Transactions and imports",
    description:
      "This route isolates transaction management from the overview so manual entry, CSV import, and dashboard feeds can be implemented without reshaping the app again.",
    intentTitle: "Why this route exists",
    intentSummary:
      "Transactions drive the rest of the product. Routing them early avoids coupling import, categorization, and dashboard work to a static homepage.",
    intentBullets: [
      "Creates a home for manual transaction entry and later transaction lists.",
      "Separates CSV import concerns from analytics presentation.",
      "Lets dashboard issue work consume transaction logic rather than define page structure.",
    ],
    primaryCta: {
      href: "/goals",
      label: "Next: goals route",
    },
    secondaryCta: {
      href: "/accounts",
      label: "View accounts route",
    },
    scopeGroups: [
      {
        title: "Planned interactions",
        summary: "These items map directly to iteration 2 work.",
        items: [
          "Manual income, expense, transfer, and savings entry.",
          "CSV upload, mapping, preview, and review states.",
          "Category editing and transfer-safe reporting inputs.",
        ],
      },
      {
        title: "Current route contract",
        summary: "This route already establishes the presentation boundary for the next issues.",
        items: [
          "Dedicated page for transaction tooling.",
          "Shared shell navigation and route consistency.",
          "Clear linkage to issue #5 through issue #7.",
        ],
      },
    ],
    acceptanceGates: [
      "Transactions are no longer embedded as a home page section.",
      "CSV import has a clear future route target.",
      "Dashboard issue work can depend on this route existing.",
    ],
    issueNumber: 5,
    issueHref: "https://github.com/hspiira/moat/issues/5",
    issueSummary: "Build transactions, categories, and transfer handling.",
  },
  goals: {
    eyebrow: "Goal Planning Surface",
    title: "Goals and emergency fund",
    description:
      "This route establishes a dedicated surface for savings targets and emergency-fund planning before the actual goal mechanics are implemented.",
    intentTitle: "Why this route exists",
    intentSummary:
      "Goals are a separate product concern from raw spending analysis. They need their own route so the moat-building behavior can evolve cleanly.",
    intentBullets: [
      "Separates future goal math from dashboard summary cards.",
      "Creates a stable destination for emergency-fund-first guidance.",
      "Supports iteration 3 without another structural refactor.",
    ],
    primaryCta: {
      href: "/investment-compass",
      label: "Next: investment route",
    },
    secondaryCta: {
      href: "/transactions",
      label: "Back to transactions",
    },
    scopeGroups: [
      {
        title: "Planned interactions",
        summary: "This route will later host the moat-building mechanics.",
        items: [
          "Goal creation for emergency fund, rent, land, and school fees.",
          "Monthly contribution calculations.",
          "Progress updates from savings-linked activity.",
        ],
      },
      {
        title: "Current route contract",
        summary: "The page now holds the space that later issues can populate.",
        items: [
          "Dedicated shell entry for goal planning.",
          "Explicit emergency-fund framing ahead of investment features.",
          "Stable location for issue #8 acceptance work.",
        ],
      },
    ],
    acceptanceGates: [
      "Goal planning is represented as a first-class route.",
      "The shell sequence supports the intended user journey from tracking to saving.",
      "Issue #8 can build behavior without moving navigation again.",
    ],
    issueNumber: 8,
    issueHref: "https://github.com/hspiira/moat/issues/8",
    issueSummary: "Build goals and emergency fund planning.",
  },
  "investment-compass": {
    eyebrow: "Guidance Surface",
    title: "Investment Compass",
    description:
      "This route gives the app a dedicated place for deterministic guidance, suitability rules, and safer local investment framing.",
    intentTitle: "Why this route exists",
    intentSummary:
      "Guidance should not be mixed into general dashboard messaging. It needs a route where rules, warnings, and local product classes can be explained directly.",
    intentBullets: [
      "Creates a dedicated surface for non-advisory guidance.",
      "Keeps investment messaging separate from budget summaries.",
      "Supports rule-based output and source-backed education.",
    ],
    primaryCta: {
      href: "/learn",
      label: "Next: learn route",
    },
    secondaryCta: {
      href: "/goals",
      label: "Back to goals",
    },
    scopeGroups: [
      {
        title: "Planned interactions",
        summary: "These are the concrete behaviors expected in iteration 3.",
        items: [
          "Time-horizon and liquidity-aware guidance outputs.",
          "Warnings for high-cost debt, low emergency reserves, and scams.",
          "Product-class explanations for Treasury instruments, SACCOs, unit trusts, and retirement paths.",
        ],
      },
      {
        title: "Current route contract",
        summary: "The route now exists as a stable entry point for guidance work.",
        items: [
          "Navigation destination for issue #9.",
          "Separate context from dashboard and goals pages.",
          "Direct path into Learn Uganda resources.",
        ],
      },
    ],
    acceptanceGates: [
      "The app has a dedicated guidance route.",
      "Investment messaging has a clean shell boundary.",
      "Issue #9 can ship without another navigation rewrite.",
    ],
    issueNumber: 9,
    issueHref: "https://github.com/hspiira/moat/issues/9",
    issueSummary: "Build Investment Compass and Learn Uganda.",
  },
  learn: {
    eyebrow: "Education Surface",
    title: "Learn Uganda",
    description:
      "This route reserves a proper home for source-backed Uganda finance education instead of scattering references across implementation notes.",
    intentTitle: "Why this route exists",
    intentSummary:
      "The product promises local, explainable guidance. That requires a route dedicated to official sources and practical education.",
    intentBullets: [
      "Supports official-source aggregation from BoU, CMA, USE, UMRA, URBRA, UBOS, and FSD Uganda.",
      "Separates literacy content from transactional workflows.",
      "Gives issue #9 a distinct educational surface.",
    ],
    primaryCta: {
      href: "/",
      label: "Return to overview",
    },
    secondaryCta: {
      href: "/investment-compass",
      label: "Back to investment route",
    },
    scopeGroups: [
      {
        title: "Planned interactions",
        summary: "This route will become the reference layer for the app.",
        items: [
          "Official and licensed source listings.",
          "Uganda-first investing and savings explainers.",
          "Institution verification and scam-avoidance guidance.",
        ],
      },
      {
        title: "Current route contract",
        summary: "The route exists now so content work has a stable destination.",
        items: [
          "Dedicated educational URL in the shell.",
          "Clear separation from recommendation logic.",
          "Ready surface for curated local content.",
        ],
      },
    ],
    acceptanceGates: [
      "Educational content has a dedicated route.",
      "Local sources can be added without crowding operational workflows.",
      "The shell now matches the information architecture in the product docs.",
    ],
    issueNumber: 9,
    issueHref: "https://github.com/hspiira/moat/issues/9",
    issueSummary: "Build Investment Compass and Learn Uganda.",
  },
};
