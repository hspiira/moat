import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * iOS zooms the page in when a field it is about to type into renders below
 * 16px, and does not zoom back out afterwards. So every field a keyboard opens
 * on has to be at least 16px on a phone, whatever it is on a wider screen.
 *
 * Checked here rather than left to review, because the fields are written by
 * hand in a dozen places and one `text-sm` is enough to bring it back.
 */

const ROOTS = ["components", "app"];
// Only a class with no prefix at all applies on a phone. Anything behind a
// colon (sm:, file:, focus:) either applies elsewhere or not to the typed text.
const SMALL_TEXT = /(?<![-\w:])text-(xs|sm)\b/;

// A keyboard never opens on these, so their size is a matter of looks alone.
const NO_KEYBOARD = new Set([
  "checkbox",
  "radio",
  "file",
  "range",
  "color",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
]);

function tsxFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFilesIn(full);
    return entry.isFile() && full.endsWith(".tsx") ? [full] : [];
  });
}

function typeOf(tag: string): string {
  return /type=["']([a-z]+)["']/.exec(tag)?.[1] ?? "text";
}

function offendersIn(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];

  for (const match of source.matchAll(/<(input|textarea|select)\b/g)) {
    const start = match.index;
    const close = source.indexOf(">", start);
    const tag = source.slice(start, close === -1 ? source.length : close);

    if (match[1] === "input" && NO_KEYBOARD.has(typeOf(tag))) continue;
    if (!SMALL_TEXT.test(tag)) continue;

    const line = source.slice(0, start).split("\n").length;
    found.push(`${file}:${line} <${match[1]}>`);
  }

  return found;
}

describe("fields a keyboard opens on", () => {
  it("are never smaller than 16px on a phone", () => {
    const offenders = ROOTS.flatMap((root) => tsxFilesIn(root)).flatMap(offendersIn);

    expect(
      offenders,
      "These render below 16px, so iOS zooms in when they are focused and stays " +
        "zoomed. Use text-base with sm:text-sm for the wider screen.",
    ).toEqual([]);
  });

  /* The check is worth nothing if it cannot see a plain `text-sm`, and it must
     not fire on a prefixed one, which applies somewhere there is no zoom or to
     something that is not the typed text. */
  it("tells an unprefixed class apart from a prefixed one", () => {
    expect(SMALL_TEXT.test('className="h-9 text-sm"')).toBe(true);
    expect(SMALL_TEXT.test('className="h-9 text-xs"')).toBe(true);
    expect(SMALL_TEXT.test('className="text-sm"')).toBe(true);

    expect(SMALL_TEXT.test('className="h-9 text-base sm:text-sm"')).toBe(false);
    expect(SMALL_TEXT.test('className="h-9 text-base md:text-xs"')).toBe(false);
    expect(SMALL_TEXT.test('className="text-base file:text-sm"')).toBe(false);
    expect(SMALL_TEXT.test('className="h-9 text-base"')).toBe(false);
  });

  it("reads the type it was given, and assumes text when given none", () => {
    expect(typeOf('<input type="checkbox"')).toBe("checkbox");
    expect(typeOf("<input value={x}")).toBe("text");
  });
});
