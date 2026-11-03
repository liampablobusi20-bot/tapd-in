"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeAccess, createCheckoutLink, setMonthlyPrice } from "@/lib/actions/billing";
import { revertAccountConfig, saveAccountConfig } from "@/lib/actions/admin";
import type { AccountConfig } from "@/lib/inbox/config";
import { Spinner } from "@/components/pending-button";
import { btnPrimary, field } from "@/components/ui";

const small = "inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-50";

export function AccessControls({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (change: "extend" | "paying" | "pause" | "resume", confirmText?: string) => () => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      setError(null);
      const r = await changeAccess(userId, change);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={run("extend")} className={small}>
          Extend trial 7 days
        </button>
        <button type="button" disabled={pending} onClick={run("paying", "Mark this account as paying (billed outside Stripe, or already paid)? It will have no end date.")} className={small}>
          Mark as paying
        </button>
        <button type="button" disabled={pending} onClick={run("pause", "Pause this account? Nothing new will be read, sorted or emailed until you resume it. Their data is kept.")} className={small}>
          Pause
        </button>
        <button type="button" disabled={pending} onClick={run("resume")} className={small}>
          Resume (7-day trial)
        </button>
        {pending && <Spinner className="h-3.5 w-3.5" />}
      </div>
      {error && <p className="mt-2 text-sm text-alert">{error}</p>}
    </div>
  );
}

export function PriceForm({ userId, current }: { userId: string; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(current);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted">$</span>
      <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="99" style={{ width: "6.5rem", flex: "none" }} className={field} />
      <span className="text-sm text-muted">per month</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setMonthlyPrice(userId, value);
            setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
            if (r.ok) router.refresh();
          })
        }
        className={small}
      >
        {pending && <Spinner className="h-3 w-3" />}Save price
      </button>
      {msg && <span className={`text-sm ${msg.ok ? "text-accent" : "text-alert"}`}>{msg.text}</span>}
    </div>
  );
}

export function CheckoutLink({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createCheckoutLink(userId);
            if (r.ok) {
              try {
                await navigator.clipboard.writeText(r.url);
                setResult({ ok: true, text: "Payment link copied. Send it to them." });
              } catch {
                setResult({ ok: true, text: r.url });
              }
            } else setResult({ ok: false, text: r.error });
          })
        }
        className={small}
      >
        {pending && <Spinner className="h-3 w-3" />}Create payment link
      </button>
      {result && <p className={`mt-2 break-all text-sm ${result.ok ? "text-accent" : "text-alert"}`}>{result.text}</p>}
    </div>
  );
}

const check = "h-4 w-4 rounded border-line accent-[var(--color-accent)]";

export function ConfigForm({ userId, config }: { userId: string; config: AccountConfig }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const feats: [keyof AccountConfig["features"], string][] = [
    ["people", "People page"],
    ["waitingOnYou", "Waiting on you"],
    ["owedToYou", "Owed to you"],
    ["meetingBriefs", "Meeting briefs"],
    ["urgentAlerts", "Urgent alerts"],
    ["texts", "Texts"],
  ];
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await saveAccountConfig(userId, fd);
          setResult(r.ok ? { ok: true, lines: r.changes.length ? r.changes : ["No changes."] } : { ok: false, lines: r.errors });
          if (r.ok) router.refresh();
        })
      }
      className="flex flex-col gap-6"
    >
      <div>
        <label className="text-xs font-medium tracking-wide text-muted">Guidance for judging their messages</label>
        <textarea
          name="triageNotes"
          defaultValue={config.triageNotes}
          rows={4}
          maxLength={1200}
          placeholder="e.g. Anything about permits, inspections or the Henderson job is urgent. Ignore automated shipping notices."
          className={`${field} mt-1.5 w-full`}
        />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium tracking-wide text-muted">Always urgent senders (one per line)</label>
          <textarea name="alwaysUrgent" defaultValue={config.alwaysUrgent.join("\n")} rows={4} placeholder={"Dana Ruiz\n@acme.com\npat@vendor.com"} className={`${field} mt-1.5 w-full`} />
        </div>
        <div>
          <label className="text-xs font-medium tracking-wide text-muted">Ignored senders (one per line)</label>
          <textarea name="ignoreSenders" defaultValue={config.ignoreSenders.join("\n")} rows={4} placeholder={"@payroll-notices.com\nNewsletter Bot"} className={`${field} mt-1.5 w-full`} />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium tracking-wide text-muted">Summary length</label>
          <select name="summaryStyle" defaultValue={config.summaryStyle} className={`${field} mt-1.5 w-full`}>
            <option value="normal">Normal</option>
            <option value="short">Short (one sentence)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium tracking-wide text-muted">Quiet from (hour, 0 to 23)</label>
          <input name="quietFromHour" type="number" min={0} max={23} defaultValue={config.quietFromHour} className={`${field} mt-1.5 w-full`} />
        </div>
        <div>
          <label className="text-xs font-medium tracking-wide text-muted">Quiet until (hour, 0 to 23)</label>
          <input name="quietUntilHour" type="number" min={0} max={23} defaultValue={config.quietUntilHour} className={`${field} mt-1.5 w-full`} />
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="urgentVipOnly" defaultChecked={config.urgentVipOnly} className={check} />
        Send urgent alert emails only for their always-urgent senders
      </label>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted">What they can see</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {feats.map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <input type="checkbox" name={`feat_${key}`} defaultChecked={config.features[key]} className={check} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium tracking-wide text-muted">Why you&apos;re changing it (kept in the history)</label>
        <input name="note" maxLength={200} placeholder="e.g. Asked on a call to flag his two big accounts" className={`${field} mt-1.5 w-full`} />
      </div>
      {result && (
        <ul className={`rounded-2xl px-5 py-3 text-sm ${result.ok ? "bg-accent-soft text-accent" : "bg-alert-soft text-alert"}`}>
          {result.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <div>
        <button type="submit" disabled={pending} className={`${btnPrimary} inline-flex items-center gap-2 disabled:opacity-60`}>
          {pending && <Spinner className="h-3.5 w-3.5" />}Save for this account only
        </button>
      </div>
    </form>
  );
}

export function RevertButton({ userId, historyId }: { userId: string; historyId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Undo this change for this account?")) start(async () => { await revertAccountConfig(userId, historyId); router.refresh(); });
      }}
      className="text-xs text-faint transition-colors hover:text-alert disabled:opacity-50"
    >
      {pending ? "Undoing…" : "Undo"}
    </button>
  );
}
