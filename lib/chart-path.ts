export type ChartPoint = { x: number; y: number };

const SMOOTHING = 0.2;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

// A smooth line through every point, as an SVG cubic path.
//
// Control points are clamped to each segment's own y range. Plain Catmull-Rom
// overshoots around a sharp turn, and on a balance chart an overshoot draws a
// dip to a figure that never happened. Clamping keeps the curve inside the data
// it is drawing, at the cost of flattening slightly at the turns.
export function smoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  const segments: string[] = [`M ${points[0].x},${points[0].y}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const start = points[index];
    const end = points[index + 1];
    const following = points[index + 2] ?? end;

    const low = Math.min(start.y, end.y);
    const high = Math.max(start.y, end.y);

    const firstControl = {
      x: start.x + (end.x - previous.x) * SMOOTHING,
      y: clamp(start.y + (end.y - previous.y) * SMOOTHING, low, high),
    };
    const secondControl = {
      x: end.x - (following.x - start.x) * SMOOTHING,
      y: clamp(end.y - (following.y - start.y) * SMOOTHING, low, high),
    };

    segments.push(
      `C ${firstControl.x.toFixed(3)},${firstControl.y.toFixed(2)} ${secondControl.x.toFixed(3)},${secondControl.y.toFixed(2)} ${end.x.toFixed(3)},${end.y.toFixed(2)}`,
    );
  }

  return segments.join(" ");
}

// The same curve, closed down to a baseline so it can be filled.
export function smoothAreaPath(points: ChartPoint[], baseline: number): string {
  if (points.length < 2) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${smoothLinePath(points)} L ${last.x},${baseline} L ${first.x},${baseline} Z`;
}
