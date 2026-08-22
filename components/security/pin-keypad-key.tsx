"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 550;

export function Key({
  children,
  onPress,
  onLongPress,
  disabled,
  variant = "solid",
  ariaLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
  ariaLabel?: string;
}) {
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  function startLongPress() {
    if (!onLongPress) return;
    longPressFired.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressFired.current) {
          longPressFired.current = false;
          return;
        }
        onPress();
      }}
      onPointerDown={onLongPress ? startLongPress : undefined}
      onPointerUp={onLongPress ? cancelLongPress : undefined}
      onPointerLeave={onLongPress ? cancelLongPress : undefined}
      onContextMenu={onLongPress ? (e) => e.preventDefault() : undefined}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "grid size-16 place-items-center rounded-full font-display text-2xl font-medium tabular-nums select-none",
        "transition-[background-color,transform] duration-100 active:scale-95",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-40",
        variant === "solid"
          ? "bg-muted/60 text-foreground hover:bg-muted active:bg-muted"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

