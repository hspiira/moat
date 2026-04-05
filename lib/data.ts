import type { AppSection, Milestone, ProductHighlight } from "@/lib/types";

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
