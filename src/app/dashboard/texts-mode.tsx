"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTextsMode } from "@/lib/actions/texts";
import { Spinner } from "@/components/pending-button";
import { btnPrimary } from "@/components/ui";

const option = "flex-1 rounded-2xl border p-5 text-left transition-colors";

export function TextsModeCard({ mode }: { mode: "private" | "easy" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choosing, setChoosing] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (next: "private" | "easy") =>
    start(async () => {
      setError(null);
      const result = await setTextsMode(next, agreed);
      if (result.ok) {
        setChoosing(false);
        setAgreed(false);
        router.refresh();
      } else setError(result.error);
    });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className={`${option} ${mode === "private" ? "border-accent bg-accent-soft" : "border-line"}`}>
          <p className="font-medium">Private mode{mode === "private" && <span className="ml-2 text-xs font-normal text-accent">Current</span>}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Your iPhone only sends texts from the people you pick in Shortcuts. Everyone else&apos;s never leave your phone. Adding a person later
            means editing the automation on the phone.
          </p>
        </div>
        <div className={`${option} ${mode === "easy" ? "border-accent bg-accent-soft" : "border-line"}`}>
          <p className="font-medium">Easy mode{mode === "easy" && <span className="ml-2 text-xs font-normal text-accent">Current</span>}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Your iPhone sends every text, and Tapd In immediately discards any that aren&apos;t from someone on your list. Add someone below and it works
            straight away, with nothing to change on your phone.
          </p>
        </div>
      </div>

      {mode === "easy" && (
        <div className="mt-5 rounded-2xl bg-card px-1 text-sm leading-relaxed text-muted">
          <p className="font-medium text-ink">What happens to a text from someone not on your list</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>It is not saved, not summarized, and not sent to the AI.</li>
            <li>We don&apos;t keep who sent it. (Unless you turn on &quot;Offer new numbers&quot; below, which keeps only the number, never the message.)</li>
            <li>It passes through our server for a moment and is then gone.</li>
          </ul>
          <button
            type="button"
            disabled={pending}
            onClick={() => change("private")}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-ink disabled:opacity-50"
          >
            {pending && <Spinner className="h-3 w-3" />}
            Switch back to private mode
          </button>
        </div>
      )}

      {mode === "private" && !choosing && (
        <button type="button" onClick={() => setChoosing(true)} className="mt-5 text-sm font-medium text-ink underline underline-offset-4">
          Use easy mode instead
        </button>
      )}

      {mode === "private" && choosing && (
        <div className="mt-5 rounded-2xl border border-line p-5">
          <p className="text-sm leading-relaxed text-muted">
            In easy mode your iPhone sends <strong className="font-medium text-ink">every</strong> text it receives to Tapd In, including personal ones.
            Tapd In immediately discards any that aren&apos;t from someone on your list. It doesn&apos;t save them, summarize them, or send them to the AI.
            Only texts from the people you add here are ever kept.
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-[var(--color-accent)]" />
            <span>I understand Tapd In will receive all of my text messages, including personal ones, and will keep only those from people on my list.</span>
          </label>
          {error && <p className="mt-3 text-sm text-alert">{error}</p>}
          <div className="mt-4 flex items-center gap-5">
            <button type="button" disabled={pending || !agreed} onClick={() => change("easy")} className={`${btnPrimary} inline-flex items-center gap-2 disabled:opacity-50`}>
              {pending && <Spinner className="h-3.5 w-3.5" />}
              Turn on easy mode
            </button>
            <button type="button" onClick={() => { setChoosing(false); setAgreed(false); setError(null); }} className="text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === "easy" && error && <p className="mt-3 text-sm text-alert">{error}</p>}
    </div>
  );
}
