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
