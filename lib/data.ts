import type { ModulePreview, NavItem } from "@/lib/types";

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
    href: "/shopping",
    label: "Shopping",
    description: "Plan what to buy and remember what it cost last time.",
  },
  {
    href: "/report",
    label: "Report",
    description: "How your money has moved over time.",
  },
  {
    href: "/goals",
    label: "Goals",
    description: "Emergency fund and savings goal tracking.",
  },
  {
    href: "/budgets",
    label: "Budgets",
    description: "Monthly spending limits per category.",
  },
  {
    href: "/debt",
    label: "Money owed",
    description: "What you owe, what you are owed, and when each clears.",
  },
  {
    href: "/recurring",
    label: "Recurring bills",
    description: "Rent, school fees, and other repeating obligations.",
  },
  {
    href: "/investment-compass",
    label: "Compass",
    description: "Rule-based guidance for Uganda investments.",
  },
  {
    href: "/learn",
    label: "Official sources",
    description: "Regulator and research links behind this app's Uganda assumptions.",
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
    title: "Official sources",
    summary: "Regulator links for verifying an institution before you commit money.",
    stage: "Active",
  },
];
