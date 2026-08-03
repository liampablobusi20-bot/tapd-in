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
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
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
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    );
    if (!res.ok) console.error("Twilio SMS failed:", res.status, await res.text());
  } catch (err) {
    console.error("Twilio SMS error:", err);
  }
}

// Best-effort side channel: a failure here must never break the save that
// triggered it, so every error is caught and logged, never thrown.
export async function notifyGuestsOfChange(
  calendarId: string,
  message: string,
  excludeToken?: string
) {
  try {
    const admin = createAdminClient();

    const { data: calendar } = await admin
      .from("calendars")
      .select("name")
      .eq("id", calendarId)
      .maybeSingle();

    const { data: links } = await admin
      .from("guest_links")
      .select("token, email, phone, notify_via")
      .eq("calendar_id", calendarId)
      .is("revoked_at", null)
      .not("notify_via", "is", null);

    if (!links?.length) return;

    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://tapd-in.vercel.app";
    const calendarName = calendar?.name || "your project";

    await Promise.all(
      links
        .filter((link) => link.token !== excludeToken)
        .map((link) => {
          const url = `${origin}/c/${link.token}`;
          if (link.notify_via === "email" && link.email) {
            return sendEmail(
              link.email,
              `${calendarName} was updated`,
              `${message}\n\nView it here: ${url}`
            );
          }
          if (link.notify_via === "sms" && link.phone) {
            return sendSms(link.phone, `${calendarName}: ${message} ${url}`);
          }
          return undefined;
        })
    );
  } catch (err) {
    console.error("notifyGuestsOfChange failed:", err);
  }
}
