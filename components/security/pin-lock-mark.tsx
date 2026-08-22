"use client";

import { IconLockFilled, IconLockOpen } from "@tabler/icons-react";

import { MoatRing } from "@/components/moat/moat-ring";
import { cn } from "@/lib/utils";

export function LockMark({ spinning, open, progress = 1 }: { spinning: boolean; open: boolean; progress?: number }) {
  return (
    <div className="relative grid place-items-center">
      {open ? (
        <span
          aria-hidden
          className="absolute size-16 rounded-full bg-primary/30 blur-lg"
          style={{ animation: "moat-unlock-glow 0.7s ease-out forwards" }}
        />
      ) : null}

      <MoatRing
        value={progress}
        size={72}
        thickness={5}
        ariaLabel={open ? "Unlocked" : "Moat is locked"}
      />

      {!open ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ animation: `moat-orbit ${spinning ? "0.8s" : "9s"} linear infinite` }}
        >
          <span className="absolute top-[-0.5px] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-clay" />
        </div>
      ) : null}

      <span
        aria-hidden
        className={cn(
          "absolute grid place-items-center transition-opacity duration-200",
          open ? "opacity-0" : "opacity-100",
        )}
      >
        <IconLockFilled className="size-5 text-primary" />
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute grid place-items-center transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      >
        <IconLockOpen className="size-5 text-primary" />
      </span>
    </div>
  );
}

