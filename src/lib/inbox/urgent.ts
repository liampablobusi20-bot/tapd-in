import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { formatPhone, isNumberLabel } from "@/lib/inbox/texts";
import { URGENT_LOOKBACK_MS, composeUrgentEmail, inQuietHours, type UrgentItem } from "@/lib/inbox/urgent-logic";

export type UrgentResult = { owners: number; emails: number; messages: number; quiet: boolean };

type Row = {
  id: string;
  owner_id: string;
  source: string;
  sender_name: string | null;
  sender_address: string | null;
  summary: string | null;
};

const senderLabel = (m: Row) =>
  (m.source === "sms" && m.sender_address && isNumberLabel(m.sender_name) ? formatPhone(m.sender_address) : m.sender_name || m.sender_address) || "Someone";

// Emails each person who turned alerts on, at most once per urgent message, with
// everything that's new bundled into a single email. Only summaries are sent.
export async function sendUrgentAlerts(nowMs = Date.now()): Promise<UrgentResult> {
  const result: UrgentResult = { owners: 0, emails: 0, messages: 0, quiet: false };
  if (inQuietHours(nowMs)) return { ...result, quiet: true };

  const admin = createAdminClient();
  const { data: owners } = await admin
    .from("users")
    .select("id, email, display_name")
    .eq("urgent_alerts", true)
    .eq("inbox_enabled", true)
    .limit(500);
  if (!owners?.length) return result;

  const { data: rows } = await admin
    .from("inbox_messages")
    .select("id, owner_id, source, sender_name, sender_address, summary")
    .in("owner_id", owners.map((o) => o.id))
    .eq("status", "processed")
    .eq("importance", "urgent")
    .is("alerted_at", null)
    .gte("processed_at", new Date(nowMs - URGENT_LOOKBACK_MS).toISOString())
    .order("received_at", { ascending: true })
    .limit(300);

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  for (const owner of owners) {
    const mine = (rows ?? []).filter((r) => r.owner_id === owner.id && r.summary);
    if (mine.length === 0) continue;

    // Claim them first, so two overlapping runs never send the same alert twice.
    const { data: claimed } = await admin
      .from("inbox_messages")
      .update({ alerted_at: new Date(nowMs).toISOString() })
      .in("id", mine.map((m) => m.id))
      .is("alerted_at", null)
      .select("id");
    const won = new Set((claimed ?? []).map((c) => c.id));
    const items: UrgentItem[] = mine
      .filter((m) => won.has(m.id))
      .map((m) => ({ sender: senderLabel(m), via: m.source === "sms" ? "text" : "email", summary: m.summary! }));
    if (items.length === 0) continue;

    const mail = composeUrgentEmail(owner.display_name, items, site ? `${site}/dashboard` : undefined);
    const ok = await sendEmail(owner.email, mail.subject, mail.text);
    if (!ok) {
      // Let the next run try again.
      await admin.from("inbox_messages").update({ alerted_at: null }).in("id", [...won]);
      continue;
    }
    result.owners++;
    result.emails++;
    result.messages += items.length;
  }
  return result;
}
