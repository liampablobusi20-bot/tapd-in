import { createAdminClient } from "@/lib/supabase/admin";

async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping email notification");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Tapd In <onboarding@resend.dev>",
        to,
        subject,
        text,
      }),
    });
    if (!res.ok) console.error("Resend email failed:", res.status, await res.text());
  } catch (err) {
    console.error("Resend email error:", err);
  }
}

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || !messagingServiceSid) {
    console.warn("Twilio env vars not set — skipping SMS notification");
    return;
  }
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          MessagingServiceSid: messagingServiceSid,
          Body: body,
        }),
      }
    );
    if (!res.ok) console.error("Twilio SMS failed:", res.status, await res.text());
  } catch (err) {
    console.error("Twilio SMS error:", err);
  }
}

// Who should hear about a change that touches these items: everyone if any of
// them is unrestricted, otherwise only the groups that can see at least one.
export function audienceForItems(
  items: { visible_group_ids: string[] | null }[]
): string[] | null {
  if (items.some((item) => item.visible_group_ids === null)) return null;
  return [...new Set(items.flatMap((item) => item.visible_group_ids ?? []))];
}

const NOTIFY_DELAY_MS = Number(process.env.NOTIFY_DELAY_MS ?? 20000);

// One notification for a burst of changes: a single message as-is, or a short
// list. SMS is kept brief; email gets the fuller list.
export function composeDigest(
  calendarName: string,
  messages: string[],
  url: string,
  channel: "sms" | "email"
): { subject: string; body: string } {
  const unique = [...new Set(messages)];
  const clip = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;

  if (unique.length === 1) {
    return {
      subject: clip(`${calendarName}: ${unique[0]}`, 90),
      body:
        channel === "sms"
          ? `${calendarName}: ${clip(unique[0], 200)} ${url}`
          : `${unique[0]}\n\nOpen it: ${url}`,
    };
  }

  const subject = `${calendarName}: ${unique.length} updates`;
  if (channel === "sms") {
    const shown = unique.slice(0, 2).map((m) => clip(m, 90)).join("; ");
    const more = unique.length > 2 ? `; +${unique.length - 2} more` : "";
    return { subject, body: `${calendarName}: ${unique.length} updates — ${shown}${more} ${url}` };
  }
  const lines = unique.slice(0, 8).map((m) => `• ${m}`);
  if (unique.length > 8) lines.push(`…and ${unique.length - 8} more`);
  return { subject, body: `${lines.join("\n")}\n\nOpen it: ${url}` };
}

type QueueRow = {
  message: string;
  audience: string[] | null;
  actor_link_id: string | null;
};

// Claims every waiting change at least `minAgeMs` old (each exactly once, even
// if two flushes race) and sends each person one combined message.
async function flushNotifications(calendarId: string, minAgeMs: number) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - minAgeMs).toISOString();
  const { data: rows } = await admin
    .from("notification_queue")
    .update({ sent_at: new Date().toISOString() })
    .eq("calendar_id", calendarId)
    .is("sent_at", null)
    .lte("created_at", cutoff)
    .select("message, audience, actor_link_id, created_at")
    .order("created_at", { ascending: true });
  if (!rows?.length) return;
  await deliverDigest(calendarId, rows as QueueRow[]);
}

async function deliverDigest(calendarId: string, queued: QueueRow[]) {
  const admin = createAdminClient();
  const { data: calendar } = await admin
    .from("calendars")
    .select("name, owner_id")
    .eq("id", calendarId)
    .maybeSingle();
  const calendarName = calendar?.name || "your project";
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://tapd-in.vercel.app";

  const { data: links } = await admin
    .from("guest_links")
    .select("id, token, email, phone, notify_via, group_id")
    .eq("calendar_id", calendarId)
    .is("revoked_at", null)
    .not("notify_via", "is", null);

  const sends: Promise<unknown>[] = [];

  for (const link of links ?? []) {
    const mine = queued.filter(
      (row) =>
        row.actor_link_id !== link.id &&
        (row.audience === null ||
          (link.group_id !== null && row.audience.includes(link.group_id)))
    );
    if (!mine.length) continue;
    const url = `${origin}/c/${link.token}`;
    const messages = mine.map((row) => row.message);
    if (link.notify_via === "email" && link.email) {
      const { subject, body } = composeDigest(calendarName, messages, url, "email");
      sends.push(sendEmail(link.email, subject, body));
    } else if (link.notify_via === "sms" && link.phone) {
      sends.push(sendSms(link.phone, composeDigest(calendarName, messages, url, "sms").body));
    }
  }

  // The owner hears about what guests do, never about their own edits.
  const fromGuests = queued.filter((row) => row.actor_link_id !== null);
  if (fromGuests.length && calendar?.owner_id) {
    const { data: owner } = await admin
      .from("users")
      .select("email, notify_email")
      .eq("id", calendar.owner_id)
      .maybeSingle();
    if (owner?.email && owner.notify_email) {
      const { subject, body } = composeDigest(
        calendarName,
        fromGuests.map((row) => row.message),
        `${origin}/dashboard/calendars/${calendarId}`,
        "email"
      );
      sends.push(sendEmail(owner.email, subject, body));
    }
  }

  await Promise.all(sends);
}

// Best-effort side channel: a failure here must never break the save that
// triggered it, so every error is caught and logged, never thrown. Changes
// wait ~20s so a burst of edits goes out as one message.
export async function notifyGuestsOfChange(
  calendarId: string,
  message: string,
  excludeToken?: string,
  visibleGroupIds?: string[] | null
) {
  try {
    const admin = createAdminClient();

    let actorLinkId: string | null = null;
    if (excludeToken) {
      const { data: link } = await admin
        .from("guest_links")
        .select("id")
        .eq("token", excludeToken)
        .eq("calendar_id", calendarId)
        .maybeSingle();
      actorLinkId = link?.id ?? null;
    }

    const { error } = await admin.from("notification_queue").insert({
      calendar_id: calendarId,
      message,
      audience: visibleGroupIds ?? null,
      actor_link_id: actorLinkId,
    });
    if (error) {
      // No queue (e.g. the migration hasn't run): send right away instead of
      // dropping the notification.
      console.error("notification queue insert failed:", error.message);
      await deliverDigest(calendarId, [
        { message, audience: visibleGroupIds ?? null, actor_link_id: actorLinkId },
      ]);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, NOTIFY_DELAY_MS));
    // Sends everything waiting, including anything an earlier invocation left
    // behind if it ended before flushing.
    await flushNotifications(calendarId, 0);
  } catch (err) {
    console.error("notifyGuestsOfChange failed:", err);
  }
}
