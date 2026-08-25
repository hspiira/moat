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
  IconRepeat,
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
  "/budgets": IconWallet,
  "/shopping": IconShoppingCart,
  "/debt": IconCreditCard,
  "/recurring": IconRepeat,
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

// One vocabulary for everything outside the primary slots: when a thing needs
// you, not which feature it belongs to. Both platforms render these same
// groups, so a destination cannot be reachable on one and missing on the other.
export const navGroups = [
  { title: "As things arrive", hrefs: ["/inbox"] },
  { title: "Every month", hrefs: ["/month", "/budgets", "/recurring"] },
  { title: "Look back", hrefs: ["/report", "/projects"] },
  { title: "Plan ahead", hrefs: ["/goals", "/shopping", "/debt"] },
  { title: "Set up once", hrefs: ["/settings/rules", "/settings/categories", "/settings"] },
  { title: "Reference", hrefs: ["/learn"] },
] as const;

// Destinations that are not modules in their own right, so they are not in
// navItems. Everything else takes its label from there rather than repeating it.
const cadenceEntries: Record<string, { label: string; description: string }> = {
  "/inbox": {
    label: "Capture review",
    description: "Transactions read from messages, waiting on your decision.",
  },
  "/month": {
    label: "Month check",
    description: "One pass over the month before you put it to bed.",
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

export const mobileCaptureActions = [
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
] as const;

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
