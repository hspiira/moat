import {
  IconAdjustmentsHorizontal,
  IconBuildingBank,
  IconBusinessplan,
  IconCalendarCheck,
  IconChartHistogram,
  IconCreditCard,
  IconFileImport,
  IconFolders,
  IconHome2,
  IconInbox,
  IconSchool,
  IconSettings,
  IconShoppingCart,
  IconTags,
  IconTransfer,
  IconWallet,
  type Icon,
} from "@tabler/icons-react";

import { navItems } from "@/lib/data";

export const navIcons: Record<string, Icon> = {
  "/": IconHome2,
  "/accounts": IconBuildingBank,
  "/transactions": IconTransfer,
  "/goals": IconBusinessplan,
  "/plan": IconWallet,
  "/shopping": IconShoppingCart,
  "/debt": IconCreditCard,
  "/projects": IconFolders,
  "/learn": IconSchool,
  "/report": IconChartHistogram,
  "/settings": IconSettings,
  "/inbox": IconInbox,
  "/month": IconCalendarCheck,
  "/import": IconFileImport,
  "/settings/rules": IconAdjustmentsHorizontal,
  "/settings/categories": IconTags,
};

export const mobilePrimaryNav = ["/", "/transactions", "/accounts"] as const;

// The bar has five fixed slots and no room for "Transactions", so that one slot
// gets a shorter name. The page it opens keeps its own title: a nav shorthand
// is allowed to be shorter than a heading, never to mean something else.
export const mobileNavLabels: Record<string, string> = {
  "/transactions": "Activity",
};

export function getMobileNavLabel(href: string): string {
  return mobileNavLabels[href] ?? getNavEntry(href)?.label ?? href;
}

// Three plain groups rather than six cadence-themed ones: what you are here to
// resolve, what you are here to plan or read, and the machinery. Both platforms
// render these same groups, so a destination cannot be reachable on one and
// missing on the other. Rules and categories are configuration, so they live
// inside Settings rather than taking two rows in a menu of destinations.
export const navGroups = [
  { title: "Review", hrefs: ["/inbox", "/month"] },
  {
    title: "Planning & analysis",
    hrefs: ["/plan", "/goals", "/debt", "/shopping", "/projects", "/report"],
  },
  { title: "Settings & help", hrefs: ["/settings", "/learn"] },
] as const;

// Configuration that Settings owns rather than the menu. These are reached
// from rows inside Settings, and from the review flows that make you want
// them, so removing them from the menu must not orphan them.
export const settingsDestinations = ["/settings/categories", "/settings/rules"] as const;

// Destinations that are not modules in their own right, so they are not in
// navItems. Everything else takes its label from there rather than repeating it.
const cadenceEntries: Record<string, { label: string; description: string }> = {
  "/inbox": {
    label: "Capture inbox",
    description: "Approve entries captured from messages before they count.",
  },
  "/month": {
    label: "Month check",
    description: "Resolve problems in what is already recorded.",
  },
  "/import": {
    label: "CSV import",
    description: "Bring in statement rows from CSV.",
  },
  "/settings/rules": {
    label: "Rules & corrections",
    description: "Rules that fill in details for you, and the corrections you have made.",
  },
  "/settings/categories": {
    label: "Categories",
    description: "What each category has cost you, and where duplicates crept in.",
  },
  "/settings": {
    label: "Settings",
    description: "PIN lock, backup, data export, privacy.",
  },
};

export type CaptureAction = {
  href: string;
  label: string;
  description: string;
  // Importing a statement belongs in the same chooser as the other ways in,
  // but it is a session of work rather than one quick entry.
  secondary?: boolean;
};

export const mobileCaptureActions: readonly CaptureAction[] = [
  {
    href: "/transactions/capture?capture=expense&type=expense",
    label: "Expense",
    description: "Record money spent now.",
  },
  {
    href: "/transactions/capture?capture=income&type=income",
    label: "Income",
    description: "Record incoming money.",
  },
  {
    href: "/transactions/capture?capture=transfer&type=transfer",
    label: "Transfer",
    description: "Move money between accounts.",
  },
  {
    href: "/transactions/capture?capture=text",
    label: "Paste text",
    description: "Read a transaction from an SMS or notification.",
  },
  {
    href: "/transactions/capture?capture=statement",
    label: "Import statement",
    description: "Bring in statement rows from a CSV file.",
    secondary: true,
  },
];

export function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavEntry = { href: string; label: string; description: string };

export function getNavEntry(href: string): NavEntry | undefined {
  const item = navItems.find((entry) => entry.href === href);
  if (item) {
    return { href: item.href, label: item.label, description: item.description };
  }

  const cadence = cadenceEntries[href];
  return cadence ? { href, ...cadence } : undefined;
}

export const groupedHrefs = navGroups.flatMap((group) => [...group.hrefs]);

// A destination already sitting in the bar is not repeated in the menu, so each
// platform hides whatever it shows elsewhere.
export function navGroupsExcluding(shown: readonly string[]) {
  return navGroups
    .map((group) => ({
      title: group.title,
      hrefs: group.hrefs.filter((href) => !shown.includes(href)),
    }))
    .filter((group) => group.hrefs.length > 0);
}

export function getActiveEntryIn(
  pathname: string,
  hrefs: readonly string[],
): NavEntry | undefined {
  const href = hrefs.find((candidate) => isActiveRoute(pathname, candidate));
  return href ? getNavEntry(href) : undefined;
}

export function getActiveGroupedEntry(pathname: string): NavEntry | undefined {
  return getActiveEntryIn(pathname, groupedHrefs);
}
