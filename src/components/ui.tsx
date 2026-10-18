import Link from "next/link";

// Shared look: warm paper, ink text, one deep-green accent, serif headlines.
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 disabled:cursor-wait disabled:opacity-50";
export const field =
  "w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";
export const label = "text-xs font-medium tracking-wide text-muted";
export const eyebrow = "text-[11px] font-medium uppercase tracking-[0.18em] text-muted";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`font-display text-[26px] leading-none tracking-tight text-ink ${className}`}>
      Tapd In
    </Link>
  );
}
