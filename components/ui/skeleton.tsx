import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Pulses unless the user prefers reduced motion
 * (the global reduced-motion rule disables the animation). Marked
 * aria-hidden so screen readers announce the surrounding live region
 * instead of empty boxes.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
