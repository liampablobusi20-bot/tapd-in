// Turns pasted text into people for the texts list. Accepts what people actually have: a
// spreadsheet column pasted in, "Name, number", "number name", a bare number, an email address.
// Pure, so every format can be tested.

import { formatPhone, normalizeHandle } from "@/lib/inbox/texts";

export const MAX_IMPORT = 500;

export type ImportEntry = { name: string; handle: string; line: number };
export type ImportSkip = { line: number; text: string; reason: string };
export type ImportResult = { entries: ImportEntry[]; duplicates: number; skipped: ImportSkip[]; tooMany: boolean };

const EMAIL = /[^\s,;|<>()"'\[\]]+@[^\s,;|<>()"'\[\]]+\.[^\s,;|<>()"'\[\]]+/;
// A run that looks like a phone number: optional +, digits, and the usual spaces, dots, dashes, brackets.
const PHONE_RUN = /\+?\(?\d[\d\s().\-]{5,}\d/g;

const cleanName = (raw: string): string =>
  raw
    .replace(/[\t,;|"'<>\[\]]+/g, " ")
    .replace(/^[\s\-–—:()]+|[\s\-–—:()]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function parseContactList(text: string, max = MAX_IMPORT): ImportResult {
  const entries: ImportEntry[] = [];
  const skipped: ImportSkip[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let tooMany = false;

  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;
    const lineNo = i + 1;

    let handle: string | null = null;
    let rest = line;

    const email = line.match(EMAIL);
    if (email) {
      handle = normalizeHandle(email[0]);
      if (handle) rest = line.replace(email[0], " ");
    }
    if (!handle) {
      for (const run of line.match(PHONE_RUN) ?? []) {
        const candidate = normalizeHandle(run);
        if (candidate) {
          handle = candidate;
          rest = line.replace(run, " ");
          break;
        }
      }
    }
    if (!handle) {
      skipped.push({ line: lineNo, text: line.slice(0, 60), reason: "No phone number or email address found" });
      return;
    }
    if (seen.has(handle)) {
      duplicates++;
      return;
    }
    if (entries.length >= max) {
      tooMany = true;
      return;
    }
    seen.add(handle);
    const name = cleanName(rest);
    // No name given: the number itself stands in, and can be named later from the briefing.
    entries.push({ name: (name && /[a-z]/i.test(name) ? name : formatPhone(handle)).slice(0, 80), handle, line: lineNo });
  });

  return { entries, duplicates, skipped, tooMany };
}
