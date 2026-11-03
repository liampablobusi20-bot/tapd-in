// Deciding what happens to a text that reaches the server. Pure, so the privacy promise
// (nothing about a text from someone not on the list is ever kept) can be tested.

import { normalizeHandle } from "@/lib/inbox/texts";

export type TextsMode = "private" | "easy";

// "store": keep it and summarize it. "drop": throw it away before anything is saved.
// Someone on the list is always kept. Anyone else is dropped when the account is in easy mode
// (the phone sends every text) or when the phone asked for the list to be checked (?v=2).
// In private mode the phone has already chosen whose texts to send, so they're trusted.
export function intakeDecision(opts: { mode: TextsMode; phoneAskedForCheck: boolean; onList: boolean }): "store" | "drop" {
  if (opts.onList) return "store";
  return opts.mode === "easy" || opts.phoneAskedForCheck ? "drop" : "store";
}

// The sender's address as a phone number or email, from whichever field has it. A plain name
// has no address, so it can't be matched to anyone on the list.
export function senderHandle(number: string, from: string): string | null {
  return normalizeHandle(number) ?? normalizeHandle(from);
}
