"use client";

import { useMemo } from "react";

import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format-date";
import type { PositionPoint } from "@/lib/domain/report";

const HEIGHT = 160;

/**
 * Net position over the window, as an area under a line. Endpoints are labelled
 * with their date and value the way a statement would caption them, so the
 * shape never has to be read against an axis.
 */
export function PositionChart({ points }: { points: PositionPoint[] }) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const values = points.map((point) => point.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // A flat series would divide by zero; give it a band so the line centres.
    const span = max - min || Math.max(Math.abs(max), 1);
    const floor = max === min ? min - span / 2 : min;

    const step = 100 / (points.length - 1);
    const coords = points.map((point, index) => ({
      x: index * step,
      y: HEIGHT - ((point.balance - floor) / span) * HEIGHT,
    }));

    return {
      line: coords.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(2)}`).join(" "),
      area: `0,${HEIGHT} ${coords.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(2)}`).join(" ")} 100,${HEIGHT}`,
      last: coords[coords.length - 1],
    };
  }, [points]);

  const first = points[0];
  const last = points[points.length - 1];

  if (!geometry || !first || !last) {
    return (
      <div className="flex h-40 items-center justify-center">
        <span className="text-xs text-muted-foreground">Not enough history yet</span>
      </div>
    );
  }

  return (
    <figure className="m-0 grid gap-2">
      <svg
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label={`Position from ${formatMoney(first.balance)} on ${formatDate(first.date)} to ${formatMoney(last.balance)} on ${formatDate(last.date)}`}
      >
        <defs>
          <linearGradient id="position-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--moat-ring-fill)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--moat-ring-fill)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={geometry.area} fill="url(#position-fill)" />
        <polyline
          points={geometry.line}
          fill="none"
          stroke="var(--moat-ring-fill)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={geometry.last.x}
          cy={geometry.last.y}
          r="3"
          fill="var(--moat-ring-fill)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <figcaption className="flex items-start justify-between gap-4 text-xs text-muted-foreground">
        <span className="grid">
          <span>{formatDate(first.date)}</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatMoney(first.balance)}
          </span>
        </span>
        <span className="grid text-right">
          <span>{formatDate(last.date)}</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatMoney(last.balance)}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
