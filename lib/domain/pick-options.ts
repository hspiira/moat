/**
 * Choosing from what has been used before, or naming something new.
 *
 * Payees, units and item groups are plain text on the records that carry them.
 * Typed fresh every time they drift into near-duplicates that never group, so
 * what already exists is offered first and only a genuinely new name is added.
 */

/** Folded so "MTN MoMo", "mtn momo" and "MTN-MoMo" are one name. */
export function pickMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchPickOptions(options: string[], query: string): string[] {
  const needle = pickMatchKey(query);
  if (!needle) return options;
  return options.filter((option) => pickMatchKey(option).includes(needle));
}

/**
 * Whether what was typed is worth offering as new. A name already on the list
 * is not, however it was capitalised, or the list grows a second spelling of
 * something it already holds.
 */
export function canCreatePickOption(options: string[], query: string): boolean {
  const needle = pickMatchKey(query);
  if (!needle) return false;
  return !options.some((option) => pickMatchKey(option) === needle);
}

/**
 * The names already in use, most used first, so the common ones are reachable
 * without typing. Ties fall back to alphabetical, so the order never wanders
 * between renders.
 */
export function collectPickOptions(values: Array<string | undefined | null>): string[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const value of values) {
    const label = value?.trim();
    if (!label) continue;

    const key = pickMatchKey(label);
    const seen = counts.get(key);
    if (seen) seen.count += 1;
    else counts.set(key, { label, count: 1 });
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .map((entry) => entry.label);
}
