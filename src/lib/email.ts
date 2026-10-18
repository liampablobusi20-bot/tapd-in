// Sends one plain-text email through Resend. Returns whether it was accepted.
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return false;
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
    return res.ok;
  } catch (err) {
    console.error("Resend email error:", err);
    return false;
  }
}
