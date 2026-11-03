import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/inbox/activity-log";
import { describeChange, mergePatch, resolveConfig, toStored, validatePatch, type AccountConfig, type Patch } from "@/lib/inbox/config";

// Every account's settings are read and written here, always by owner, so no code path can
// apply one account's settings to another.

export async function getConfig(ownerId: string): Promise<AccountConfig> {
  const { data } = await createAdminClient().from("account_config").select("config").eq("owner_id", ownerId).maybeSingle();
  return resolveConfig(data?.config);
}

// Several accounts at once (one query), keyed by owner. Accounts with no row get the defaults.
export async function getConfigs(ownerIds: string[]): Promise<Map<string, AccountConfig>> {
  const map = new Map<string, AccountConfig>(ownerIds.map((id) => [id, resolveConfig(undefined)]));
  if (ownerIds.length === 0) return map;
  const { data } = await createAdminClient().from("account_config").select("owner_id, config").in("owner_id", ownerIds);
  for (const row of data ?? []) map.set(row.owner_id, resolveConfig(row.config));
  return map;
}

export type ApplyResult = { ok: true; changes: string[] } | { ok: false; errors: string[] };

// The one safe way to change an account's settings: checked, recorded with what it was
// before (so it can be undone), and noted in that account's own activity log.
export async function applyConfigPatch(ownerId: string, input: unknown, by: string, note?: string | null): Promise<ApplyResult> {
  const validated = validatePatch(input);
  if (!validated.ok) return validated;
  return writeConfig(ownerId, (before) => mergePatch(before, validated.patch as Patch), by, note);
}

export async function revertConfig(ownerId: string, historyId: string, by: string): Promise<ApplyResult> {
  const { data: row } = await createAdminClient()
    .from("account_config_history")
    .select("before")
    .eq("id", historyId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!row) return { ok: false, errors: ["That change wasn't found for this account."] };
  const restored = resolveConfig(row.before);
  return writeConfig(ownerId, () => restored, by, `Reverted change ${historyId.slice(0, 8)}`);
}

async function writeConfig(ownerId: string, next: (before: unknown) => AccountConfig, by: string, note?: string | null): Promise<ApplyResult> {
  const admin = createAdminClient();
  const { data: current } = await admin.from("account_config").select("config").eq("owner_id", ownerId).maybeSingle();
  const beforeStored = (current?.config ?? {}) as Record<string, unknown>;
  const after = next(beforeStored);
  const afterStored = toStored(after);
  const changes = describeChange(resolveConfig(beforeStored), after);
  if (changes.length === 0) return { ok: true, changes };

  const now = new Date().toISOString();
  const { error } = await admin.from("account_config").upsert({ owner_id: ownerId, config: afterStored, updated_at: now, updated_by: by }, { onConflict: "owner_id" });
  if (error) return { ok: false, errors: ["Couldn't save that. Please try again."] };
  await admin.from("account_config_history").insert({ owner_id: ownerId, changed_by: by, note: note ?? null, before: beforeStored, after: afterStored });
  await logActivity(ownerId, "settings_adjusted", changes.length === 1 ? changes[0] : `${changes.length} changes`);
  return { ok: true, changes };
}
