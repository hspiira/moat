/**
 * Record identifiers.
 *
 * Ids are bare cuid2: no type prefix, since entityType travels alongside the id
 * everywhere it matters.
 *
 * Records a user creates get a random id. Records the app seeds for every user
 * (the party-ledger pool accounts, the default categories, the profile) get an
 * id derived from the user id and a fixed slug, so two devices belonging to the
 * same user derive the same id and sync merges them instead of creating a
 * second copy of every default.
 */

import { createId as createCuid2, isCuid } from "@paralleldrive/cuid2";

const ID_LENGTH = 24;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** A fresh random id, for anything a user creates. */
export function createId(): string {
  return createCuid2();
}

export function isValidId(value: string): boolean {
  return isCuid(value);
}

/**
 * FNV-1a, 128-bit, over UTF-8 bytes.
 *
 * Written out here rather than taken from a library on purpose. Derived ids
 * have to stay identical forever — a device that recomputes a seeded id must
 * get the byte-for-byte same answer years later, on another platform, or it
 * will create a duplicate of a record it already has. A dependency could change
 * its algorithm in a minor release and silently break that. The constants below
 * are the published FNV-1a 128-bit offset basis and prime.
 */
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

/**
 * Deterministic id for a record the app seeds for every user.
 *
 * `slug` names the record's role and must never change once shipped: it is
 * half the input, so editing one repoints the record. Bump `SEEDED_ID_VERSION`
 * only if every derived id is meant to move at once, which needs a migration.
 */
const SEEDED_ID_VERSION = "v1";

// Derived ids are compared inside hot paths — isTransferTransaction runs over
// every transaction on screen — and the inputs are a handful of fixed slugs for
// one user, so the results are cached rather than recomputed per call.
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
  // NUL separates the parts so ("ab", "c") and ("a", "bc") cannot collide.
  const hash = fnv1a128(`moat/seeded-id/${SEEDED_ID_VERSION}\0${userId}\0${slug}`);

  // A cuid2 starts with a letter, so the first character comes from the
  // low bits and the rest from what remains.
  let remaining = hash;
  let out = LETTERS[Number(remaining % BigInt(LETTERS.length))];
  remaining /= BigInt(LETTERS.length);

  while (out.length < ID_LENGTH) {
    out += ALPHABET[Number(remaining % BigInt(ALPHABET.length))];
    remaining /= BigInt(ALPHABET.length);
    // 128 bits runs out before 24 base36 characters do; fold the hash back in
    // so the tail is still a function of the whole input rather than zeros.
    if (remaining === 0n) {
      remaining = fnv1a128(`${out}\0${SEEDED_ID_VERSION}`);
    }
  }

  return out;
}
