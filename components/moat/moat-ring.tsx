import { cn } from "@/lib/utils";

type MoatRingTone = "moat" | "positive" | "clay" | "neutral";

const toneStroke: Record<MoatRingTone, string> = {
  moat: "stroke-[color:var(--moat-ring-fill)]",
  positive: "stroke-[color:var(--pos)]",
  clay: "stroke-[color:var(--clay)]",
  neutral: "stroke-muted-foreground",
};

/**
 * The moat ring — Moat's signature. A concentric arc showing how much of a
 * buffer (emergency-fund coverage, goal progress) has been built. The name
 * made literal: your ring is the moat around your future self.
 *
 * Progress is announced via role="img" + aria-label; the visual value is
 * never the only channel.
 */
export function MoatRing({
  value,
  label,
  sublabel,
  ariaLabel,
  tone = "moat",
  size = 132,
  thickness = 10,
  className,
}: {
  value: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  ariaLabel: string;
  tone?: MoatRingTone;
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamped;

  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-moat-ring-track"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className={cn("transition-[stroke-dasharray] duration-700 ease-out", toneStroke[tone])}
        />
      </svg>
      {label || sublabel ? (
        <div className="absolute inset-0 grid place-content-center text-center">
          {label ? (
            <div className="font-display text-2xl leading-none font-semibold tabular-nums text-foreground">
              {label}
            </div>
          ) : null}
          {sublabel ? (
            <div className="mt-1 text-[0.7rem] leading-tight text-muted-foreground">{sublabel}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
