import { createId as createCuid2, isCuid } from "@paralleldrive/cuid2";

const ID_LENGTH = 24;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export function createId(): string {
  return createCuid2();
}

export function isValidId(value: string): boolean {
  return isCuid(value);
}

const FNV_OFFSET_BASIS = 0x6c62272e07bb014262b821756295c58dn;
const FNV_PRIME = 0x0000000001000000000000000000013bn;
const MASK_128 = (1n << 128n) - 1n;

function fnv1a128(input: string): bigint {
  const bytes = new TextEncoder().encode(input);
  let hash = FNV_OFFSET_BASIS;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_128;
  }

  return hash;
}

const SEEDED_ID_VERSION = "v1";

const derivedCache = new Map<string, string>();

export function deriveSeededId(userId: string, slug: string): string {
  const cacheKey = `${userId}\0${slug}`;
  const cached = derivedCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const derived = computeSeededId(userId, slug);
  derivedCache.set(cacheKey, derived);
  return derived;
}

function computeSeededId(userId: string, slug: string): string {
  const hash = fnv1a128(`moat/seeded-id/${SEEDED_ID_VERSION}\0${userId}\0${slug}`);

  let remaining = hash;
  let out = LETTERS[Number(remaining % BigInt(LETTERS.length))];
  remaining /= BigInt(LETTERS.length);

  while (out.length < ID_LENGTH) {
    out += ALPHABET[Number(remaining % BigInt(ALPHABET.length))];
    remaining /= BigInt(ALPHABET.length);
    if (remaining === 0n) {
      remaining = fnv1a128(`${out}\0${SEEDED_ID_VERSION}`);
    }
  }

  return out;
}
