export function buildStableHash(values: string[], prefix: string) {
  const normalized = values.map((value) => value.trim().toLowerCase()).join("|");
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index);
    hash |= 0;
  }

  return `${prefix}:${Math.abs(hash)}`;
}
