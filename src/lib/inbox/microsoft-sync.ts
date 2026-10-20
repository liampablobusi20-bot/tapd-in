import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { ingestMessage } from "@/lib/inbox/process";
import { MicrosoftAuthError, fetchInboxSince, refreshTokens, toIncoming } from "@/lib/inbox/microsoft";

export function microsoftCreds() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

type Connection = { id: string; owner_id: string; refresh_token_enc: string; synced_through: string };

// Reads one mailbox's new inbox mail and queues it for sorting. A sign-in that no
// longer works marks the connection "needs reconnect" instead of failing silently.
export async function syncConnection(conn: Connection): Promise<number> {
  const creds = microsoftCreds();
  if (!creds) return 0;
  const supabase = createAdminClient();

  let tokens;
  try {
    tokens = await refreshTokens(decryptSecret(conn.refresh_token_enc), creds);
  } catch (err) {
    if (err instanceof MicrosoftAuthError) {
      await supabase.from("inbox_connections").update({ status: "needs_reconnect" }).eq("id", conn.id);
      return 0;
    }
    throw err;
  }

  // Microsoft rotates the refresh token on every use, so keep the new one.
  await supabase
    .from("inbox_connections")
    .update({ refresh_token_enc: encryptSecret(tokens.refreshToken) })
    .eq("id", conn.id);

  // A little overlap is safe: messages already seen are ignored by their id.
  const since = new Date(Date.parse(conn.synced_through) - 2 * 60_000).toISOString();
  const messages = await fetchInboxSince(tokens.accessToken, since);

  let newest = conn.synced_through;
  for (const raw of messages) {
    const { externalId, message } = toIncoming(raw);
    await ingestMessage(conn.owner_id, externalId, message);
    if (raw.receivedDateTime > newest) newest = raw.receivedDateTime;
  }

  await supabase
    .from("inbox_connections")
    .update({ synced_through: newest, last_synced_at: new Date().toISOString() })
    .eq("id", conn.id);
  return messages.length;
}

export async function syncAllMicrosoft(): Promise<{ connections: number; messages: number; failed: number }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inbox_connections")
    .select("id, owner_id, refresh_token_enc, synced_through")
    .eq("provider", "microsoft")
    .eq("status", "active")
    .limit(200);

  const tally = { connections: 0, messages: 0, failed: 0 };
  for (const conn of data ?? []) {
    tally.connections++;
    try {
      tally.messages += await syncConnection(conn);
    } catch (err) {
      tally.failed++;
      console.error("Microsoft sync failed:", err instanceof Error ? err.message : "unknown error");
    }
  }
  return tally;
}

// Brings one person's connected mailboxes up to date right now, so a briefing
// they ask for includes mail that arrived since the last scheduled check.
export async function syncOwnerMicrosoft(ownerId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inbox_connections")
    .select("id, owner_id, refresh_token_enc, synced_through")
    .eq("owner_id", ownerId)
    .eq("provider", "microsoft")
    .eq("status", "active");

  let total = 0;
  for (const conn of data ?? []) {
    try {
      total += await syncConnection(conn);
    } catch (err) {
      console.error("Microsoft sync failed:", err instanceof Error ? err.message : "unknown error");
    }
  }
  return total;
}
