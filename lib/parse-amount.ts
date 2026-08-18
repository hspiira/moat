const GROUPING = /[\s  ,'_]/g;

export function parseAmountInput(raw: string): number | null {
  if (typeof raw !== "string") return null;

  const withoutCurrency = raw
    .trim()
    .replace(/^[a-z]+\s*/i, "")
    .replace(/\s*[a-z]+$/i, "");
  const cleaned = withoutCurrency.replace(GROUPING, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "+") return null;

  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const groupedFormatter = new Intl.NumberFormat("en-UG", {
  maximumFractionDigits: 2,
  useGrouping: true,
});

export function formatAmountForInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value) || value === 0) return "";
  return groupedFormatter.format(value);
}
