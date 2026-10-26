import Link from "next/link";
import { eyebrow } from "@/components/ui";
import { personKey } from "@/lib/inbox/people";
import type { MeetingBrief } from "@/lib/inbox/briefs";

const TZ = "America/Phoenix";

function when(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  return { day, time };
}

const ago = (iso: string, now: number) => {
  const days = Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

// A quiet "Coming up" block: each meeting, who you've heard from, and what to know.
export function MeetingBriefs({ briefs, now, linkPeople = true }: { briefs: MeetingBrief[]; now: number; linkPeople?: boolean }) {
  if (briefs.length === 0) return null;
  return (
    <section>
      <p className={eyebrow}>Coming up</p>
      <ul className="mt-5 divide-y divide-line rounded-3xl border border-line bg-card p-7 sm:p-8">
        {briefs.map((b) => {
          const t = when(b.startIso);
          const hidden = b.invited - b.attendees.length;
          return (
            <li key={b.id} className="py-5 first:pt-0 last:pb-0">
              <p className="text-[15px] leading-snug">
                <span className="font-semibold">{b.subject}</span>
                <span className="text-faint">
                  {" "}
                  · {t.day} {t.time}
                </span>
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {b.attendees.map((a) => (
                  <li key={a.address} className="text-[15px] leading-relaxed text-muted">
                    {linkPeople ? (
                      <Link href={`/dashboard/people/${encodeURIComponent(personKey(a.name, a.address))}`} className="font-medium text-ink hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{a.name}</span>
                    )}
                    {a.waiting.length > 0 && (
                      <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-[11px] font-medium text-accent">
                        Waiting on you
                      </span>
                    )}
                    {a.owed.length > 0 && (
                      <span className="ml-2 rounded-full bg-alert-soft px-2 py-0.5 align-middle text-[11px] font-medium text-alert">
                        Owes you
                      </span>
                    )}
                    {a.lastAt && <span className="text-faint"> · last heard {ago(a.lastAt, now)}</span>}
                  </li>
                ))}
              </ul>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">What to know</summary>
                <div className="mt-4 flex flex-col gap-5">
                  {b.attendees.map((a) => (
                    <div key={a.address}>
                      <p className="text-sm font-semibold">{a.name}</p>
                      <ul className="mt-2 flex flex-col gap-1.5 text-[15px] leading-relaxed text-muted">
                        {a.waiting.map((m) => (
                          <li key={`w${m.id}`}>
                            <span className="font-medium text-accent">You owe a reply:</span> {m.summary}
                          </li>
                        ))}
                        {a.owed.map((m) => (
                          <li key={`o${m.id}`}>
                            <span className="font-medium text-alert">They owe you:</span> {m.promise}
                          </li>
                        ))}
                        {a.recent.map((m) => (
                          <li key={`r${m.id}`}>
                            <span className="text-faint">{ago(m.received_at, now)}:</span> {m.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {hidden > 0 && <p className="text-xs text-faint">{hidden} other {hidden === 1 ? "person is" : "people are"} invited. You haven&apos;t heard from {hidden === 1 ? "them" : "them"} yet.</p>}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
