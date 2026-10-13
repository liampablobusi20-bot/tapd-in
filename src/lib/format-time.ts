// "09:00:00" or "09:00" -> "9:00 AM"
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hours = Number(h);
  if (Number.isNaN(hours)) return "";
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${(m ?? "00").slice(0, 2)} ${suffix}`;
}
