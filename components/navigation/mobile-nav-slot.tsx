"use client";

import Link from "next/link";
import type { Icon } from "@tabler/icons-react";

// Five slots of equal width, each with its icon above its own name. Nothing
// here grows, shrinks or swaps its label with the selection: a newcomer should
// be able to read the whole bar without tapping anything to find out what a
// picture meant, and a destination should sit in the same place every visit.
export const mobileNavSlotClass = [
  "flex h-13 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5",
  "transition-colors duration-200 ease-out",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
].join(" ");

export const mobileNavLabelClass =
  "w-full truncate text-center text-[0.6875rem] leading-none font-medium";

export function mobileNavToneClass(active: boolean) {
  return active
    ? "bg-primary text-primary-foreground"
    : "text-muted-foreground hover:text-foreground";
}

export function MobileNavSlotLink({
  href,
  label,
  icon: IconComponent,
  active,
}: {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[mobileNavSlotClass, mobileNavToneClass(active)].join(" ")}
    >
      <IconComponent className="size-5 shrink-0" stroke={active ? 2 : 1.7} />
      <span className={mobileNavLabelClass}>{label}</span>
    </Link>
  );
}
