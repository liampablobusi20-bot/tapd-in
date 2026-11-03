// Change one account's settings from the command line, safely.
//
//   node --experimental-strip-types tools/account-config.mts show <email>
//   node --experimental-strip-types tools/account-config.mts set <email> '<json>' [--note "why"] [--dry-run]
//   node --experimental-strip-types tools/account-config.mts history <email>
//   node --experimental-strip-types tools/account-config.mts revert <email> <history-id-prefix>
//   node --experimental-strip-types tools/account-config.mts trial <email> extend|paying|pause|resume
//   node --experimental-strip-types tools/account-config.mts price <email> <dollars-per-month>
//
// Every change is checked first, recorded with what it was before (so it can be undone), noted in
// that account's own activity log, and applies to that one account only. Needs .env.local.

import { readFileSync } from "node:fs";
import { describeChange, mergePatch, resolveConfig, toStored, validatePatch } from "../src/lib/inbox/config.ts";
import { extendedEnd, trialState } from "../src/lib/inbox/trial.ts";

function env(name: string): string {
  const line = readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} is missing from .env.local`);
  return line.slice(name.length + 1).trim().replace(/^"|"$/g, "");
}
const URL_ = env("NEXT_PUBLIC_SUPABASE_URL");
const KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function findAccount(email: string) {
  const rows = await rest(`users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,email,subscription_status,trial_ends_at,stripe_subscription_id,billing_issue_at,monthly_price_cents`);
  if (!rows?.length) {
    const like = await rest(`users?email=ilike.*${encodeURIComponent(email.split("@")[0])}*&select=email&limit=5`);
    throw new Error(`No account with the email ${email}.${like?.length ? ` Did you mean: ${like.map((r: { email: string }) => r.email).join(", ")}?` : ""}`);
  }
  return rows[0];
}

const stored = async (id: string) => (await rest(`account_config?owner_id=eq.${id}&select=config`))?.[0]?.config ?? {};
const log = async (id: string, event: string, detail: string | null) => rest("inbox_activity", { method: "POST", body: JSON.stringify({ owner_id: id, event, detail }), headers: { Prefer: "return=minimal" } });

async function write(id: string, before: Record<string, unknown>, afterConfig: ReturnType<typeof resolveConfig>, note: string | null, dry: boolean) {
  const beforeConfig = resolveConfig(before);
  const changes = describeChange(beforeConfig, afterConfig);
  if (changes.length === 0) return console.log("No change: that is already how this account is set up.");
  console.log(dry ? "Would change:" : "Changing:");
  for (const c of changes) console.log("  -", c);
  if (dry) return console.log("(dry run: nothing was saved)");
  const afterStored = toStored(afterConfig);
  await rest("account_config?on_conflict=owner_id", { method: "POST", body: JSON.stringify({ owner_id: id, config: afterStored, updated_at: new Date().toISOString(), updated_by: "command line" }), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
  await rest("account_config_history", { method: "POST", body: JSON.stringify({ owner_id: id, changed_by: "command line", note, before, after: afterStored }), headers: { Prefer: "return=minimal" } });
  await log(id, "settings_adjusted", changes.length === 1 ? changes[0] : `${changes.length} changes`);
  console.log("Saved, recorded in the history, and noted in their activity log.");
}

const [command, email, ...rest_] = process.argv.slice(2);
const flag = (name: string) => rest_.includes(name);
const option = (name: string) => { const i = rest_.indexOf(name); return i >= 0 ? rest_[i + 1] ?? null : null; };

try {
  if (!command || !email) throw new Error("Usage: show | set | history | revert | trial | price  <email> ...");
  const account = await findAccount(email);

  if (command === "show") {
    const before = await stored(account.id);
    console.log(`${account.email}\n\nSettings (only what differs from the standard):`);
    console.log(JSON.stringify(before, null, 2));
    console.log("\nIn effect:");
    console.log(JSON.stringify(resolveConfig(before), null, 2));
    console.log("\nAccess:", JSON.stringify(trialState(account, Date.now())), "| price:", account.monthly_price_cents ? `$${account.monthly_price_cents / 100}/month` : "not set");
  } else if (command === "set") {
    const json = rest_.find((a) => a.trim().startsWith("{"));
    if (!json) throw new Error("Give the change as JSON, e.g. '{\"alwaysUrgent\":[\"Dana Ruiz\"]}'.");
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { throw new Error("That isn't valid JSON."); }
    const v = validatePatch(parsed);
    if (!v.ok) throw new Error(`Not applied:\n  - ${v.errors.join("\n  - ")}`);
    const before = await stored(account.id);
    await write(account.id, before, mergePatch(before, v.patch), option("--note"), flag("--dry-run"));
  } else if (command === "history") {
    const rows = await rest(`account_config_history?owner_id=eq.${account.id}&select=id,changed_at,changed_by,note,before,after&order=changed_at.desc&limit=15`);
    if (!rows.length) console.log("No changes yet: this account uses the standard settings.");
    for (const r of rows) console.log(`${r.id.slice(0, 8)}  ${r.changed_at.slice(0, 16)}  ${r.changed_by}  ${r.note ?? ""}\n    ${describeChange(resolveConfig(r.before), resolveConfig(r.after)).join("\n    ") || "(no visible change)"}`);
  } else if (command === "revert") {
    const prefix = rest_[0];
    if (!prefix) throw new Error("Give the start of a history id (see the history command).");
    const rows = await rest(`account_config_history?owner_id=eq.${account.id}&select=id,before&order=changed_at.desc&limit=50`);
    const match = rows.filter((r: { id: string }) => r.id.startsWith(prefix));
    if (match.length !== 1) throw new Error(match.length ? "That prefix matches more than one change. Use more characters." : "No change with that id for this account.");
    const current = await stored(account.id);
    await write(account.id, current, resolveConfig(match[0].before), `Reverted change ${prefix}`, flag("--dry-run"));
  } else if (command === "trial") {
    const action = rest_[0];
    const now = Date.now();
    const update =
      action === "extend" ? { subscription_status: "trialing", trial_ends_at: extendedEnd(account.trial_ends_at, now, 7), billing_issue_at: null }
      : action === "paying" ? { subscription_status: "active", trial_ends_at: null, billing_issue_at: null }
      : action === "pause" ? { subscription_status: "canceled" }
      : action === "resume" ? { subscription_status: "trialing", trial_ends_at: extendedEnd(null, now, 7), billing_issue_at: null }
      : null;
    if (!update) throw new Error("Use: trial <email> extend | paying | pause | resume");
    await rest(`users?id=eq.${account.id}`, { method: "PATCH", body: JSON.stringify(update), headers: { Prefer: "return=minimal" } });
    await log(account.id, "trial_changed", null);
    console.log(`Done. ${account.email} is now: ${JSON.stringify(trialState({ ...account, ...update }, now))}`);
  } else if (command === "price") {
    const dollars = Number(rest_[0]);
    if (!Number.isFinite(dollars) || dollars < 1 || dollars > 50000) throw new Error("Give the price in dollars per month, e.g. 99 or 149.50.");
    await rest(`users?id=eq.${account.id}`, { method: "PATCH", body: JSON.stringify({ monthly_price_cents: Math.round(dollars * 100) }), headers: { Prefer: "return=minimal" } });
    console.log(`Done. ${account.email} is set to $${dollars}/month.`);
  } else {
    throw new Error(`Unknown command "${command}".`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
