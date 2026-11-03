import Link from "next/link";
import { btnPrimary } from "@/components/ui";
import { SuggestedTopicsButton } from "./inbox-forms";

function Step({ done, title, children }: { done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
          done ? "border-accent bg-accent text-paper" : "border-line text-transparent"
        }`}
      >
        ✓
      </span>
      <div className="min-w-0">
        <p className={`font-medium ${done ? "text-muted line-through decoration-line" : ""}`}>{title}</p>
        {!done && children && <div className="mt-1.5 text-sm leading-relaxed text-muted">{children}</div>}
      </div>
    </li>
  );
}

// Shown on an empty briefing: the three things to do, with what is already done ticked.
export function SetupChecklist({ connected, topics, texts }: { connected: boolean; topics: boolean; texts: boolean }) {
  return (
    <div className="mt-14 rounded-3xl border border-line bg-card p-8 sm:p-12">
      <h2 className="font-display text-3xl tracking-tight">Let&apos;s get you set up.</h2>
      <p className="mt-3 max-w-md leading-relaxed text-muted">
        Three quick steps. Your first messages appear here within a couple of minutes of connecting.
      </p>
      <ul className="mt-8 divide-y divide-line">
        <Step done={connected} title="Connect your Outlook email">
          Read-only: Tapd In can&apos;t send, delete, or change anything.
          <div className="mt-3">
            <a href="/api/connect/microsoft/start" className={btnPrimary}>
              Connect Outlook
            </a>
          </div>
        </Step>
        <Step done={topics} title="Choose how it&apos;s sorted">
          Topics like Clients, Team, and Vendors. <SuggestedTopicsButton />, or make your own in{" "}
          <Link href="/dashboard/settings" className="underline underline-offset-4">
            Settings
          </Link>
          .
        </Step>
        <Step done={texts} title="Add the people whose texts count (optional)">
          Only texts from people you pick are ever sent.{" "}
          <Link href="/dashboard/settings" className="underline underline-offset-4">
            Add people
          </Link>
          , then{" "}
          <Link href="/dashboard/settings/phone" className="underline underline-offset-4">
            set up your iPhone
          </Link>
          .
        </Step>
      </ul>
    </div>
  );
}
