// The administrator (the person running Tapd In) is set by the ADMIN_EMAILS
// environment variable, a comma-separated list. It also decides who gets alerts.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes(email!.trim().toLowerCase());
}
