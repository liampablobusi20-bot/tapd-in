// The account activity log: what is recorded, and how it reads to the owner.

export type ActivityEvent =
  | "signed_in"
  | "password_changed"
  | "two_step_failed"
  | "two_step_enabled"
  | "two_step_disabled"
  | "two_step_reset"
  | "outlook_connected"
  | "outlook_disconnected"
  | "meeting_briefs_on"
  | "meeting_briefs_off"
  | "text_person_added"
  | "text_person_removed"
  | "phone_key_created"
  | "phone_key_revoked"
  | "retention_changed"
  | "urgent_alerts_on"
  | "settings_adjusted"
  | "subscription_started"
  | "payment_failed"
  | "subscription_ended"
  | "trial_changed"
  | "urgent_alerts_off"
  | "data_deleted"
  | "weekly_email_sent";

const WORDS: Record<ActivityEvent, string> = {
  signed_in: "Signed in",
  password_changed: "Password changed",
  two_step_failed: "A two-step code was entered wrongly",
  two_step_enabled: "Two-step sign-in turned on",
  two_step_disabled: "Two-step sign-in turned off",
  two_step_reset: "Two-step sign-in was reset by Tapd In support",
  outlook_connected: "Outlook connected",
  outlook_disconnected: "Outlook disconnected",
  meeting_briefs_on: "Meeting briefs turned on",
  meeting_briefs_off: "Meeting briefs turned off",
  text_person_added: "A person was added to your texts list",
  text_person_removed: "A person was removed from your texts list",
  phone_key_created: "A phone key was created",
  phone_key_revoked: "A phone key was revoked",
  retention_changed: "Keep-summaries setting changed",
  urgent_alerts_on: "Urgent alerts turned on",
  settings_adjusted: "Your settings were adjusted by Tapd In",
  subscription_started: "Subscription started",
  payment_failed: "A payment failed",
  subscription_ended: "Subscription ended",
  trial_changed: "Trial updated by Tapd In",
  urgent_alerts_off: "Urgent alerts turned off",
  data_deleted: "All message data was deleted",
  weekly_email_sent: "Briefing emailed",
};

export function describeActivity(event: string, detail?: string | null): string {
  const base = (WORDS as Record<string, string>)[event] ?? "Account activity";
  return detail ? `${base} (${detail})` : base;
}

// "Safari on iPhone": enough to spot a device you don't recognise, nothing more.
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (!ua) return "unknown device";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  if (browser && device) return `${browser} on ${device}`;
  return browser || device || "unknown device";
}
