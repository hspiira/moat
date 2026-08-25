/**
 * Matching a captured message to something the user already named.
 *
 * Both the account a message belongs to and the category it falls under were
 * being answered by taking the first entry that fit the shape, which reads as a
 * decision and is really a coin toss: every captured expense landed in whatever
 * expense category happened to be first.
 */

/** Folded so that "MTN MoMo", "mtn-momo" and "MTNMoMo" are one name. */
function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type NamedEntry = { id: string; names: string[] };

/**
 * The entry whose name and the text account for each other, longest name first
 * so a specific one wins over a general one that happens to sit inside it.
 *
 * Containment is allowed both ways, because a sender is written shorter than the
 * account it belongs to as often as longer.
 */
export function matchByName<T extends NamedEntry>(
  entries: T[],
  haystacks: Array<string | undefined>,
): T | undefined {
  const folded = haystacks
    .map((haystack) => fold(haystack ?? ""))
    .filter((haystack) => haystack.length > 0);

  if (folded.length === 0) return undefined;

  const candidates = entries
    .flatMap((entry) =>
      entry.names
        .map((name) => fold(name))
        // A one or two letter name matches almost anything, which is worse than
        // not matching at all.
        .filter((name) => name.length >= 3)
        .map((name) => ({ entry, name })),
    )
    .sort((left, right) => right.name.length - left.name.length);

  for (const haystack of folded) {
    const hit = candidates.find(
      ({ name }) => haystack.includes(name) || name.includes(haystack),
    );
    if (hit) return hit.entry;
  }

  return undefined;
}
