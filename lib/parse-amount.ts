// Reads money the way people type and paste it. `Number("1,790,590")` is NaN,
// so every amount field that fed a raw value to Number() silently zeroed itself
// the moment a thousands separator was typed.
//
// Uganda formats money as en-UG: comma groups thousands, dot marks decimals.
// A comma is therefore always a group separator here, never a decimal mark.

const GROUPING = /[\s  ,'_]/g;

/**
 * Parses typed or pasted money text into a number.
 * Returns null when the text holds no readable amount, so callers can tell
 * "nothing entered yet" apart from "zero".
 */
export function parseAmountInput(raw: string): number | null {
  if (typeof raw !== "string") return null;

  // Drop a currency code pasted along with the figure ("UGX 1,000", "1,000 UGX").
  // Only a leading or trailing run of letters — letters *between* digits mean
  // the text is junk ("12ab34"), and stripping those would invent an amount.
  const withoutCurrency = raw
    .trim()
    .replace(/^[a-z]+\s*/i, "")
    .replace(/\s*[a-z]+$/i, "");
  const cleaned = withoutCurrency.replace(GROUPING, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "+") return null;

  // Reject anything that is not a single signed decimal, rather than letting
  // Number() half-read it — a wrong amount is worse than a rejected one.
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const groupedFormatter = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 2,
  useGrouping: true,
});

/**
 * Renders a number for display inside an amount input: grouped, and blank for
 * absent or zero values so an untouched fee box does not show a stray "0".
 */
export function formatAmountForInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value) || value === 0) return "";
  return groupedFormatter.format(value);
}
