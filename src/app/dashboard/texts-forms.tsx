"use client";

import { useRef, useState, useTransition } from "react";
import { addTextContact, createTextKey, removeTextContact, revokeTextKey, summarizeConversation, nameTextNumber, setTextSuggestions, resolveSuggestion } from "@/lib/actions/texts";
import { catchMeUp } from "@/lib/actions/people";
import { disableMeetingBriefs, disconnectEmail } from "@/lib/actions/connections";
import { PendingButton, Spinner } from "@/components/pending-button";
import { btnPrimary, btnSecondary, field } from "@/components/ui";

export function ContactForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      ref={ref}
      action={async (formData) => {
        setError(null);
        try {
          await addTextContact(formData);
          ref.current?.reset();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't add that contact.");
        }
      }}
      className="mt-6 flex flex-col gap-3 border-t border-line pt-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <input name="name" required maxLength={80} placeholder="Name, e.g. Dana Ruiz" className={field} />
        <input name="handle" required placeholder="Phone or email they text from" className={field} />
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}
      <PendingButton pendingText="Adding…" className={`${btnPrimary} self-start`}>
        Add contact
      </PendingButton>
    </form>
  );
}

export function RemoveItem({ id, kind, label }: { id: string; kind: "contact" | "key" | "connection" | "calendar"; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (kind === "contact") await removeTextContact(id);
          else if (kind === "key") await revokeTextKey(id);
          else if (kind === "calendar") await disableMeetingBriefs(id);
          else await disconnectEmail(id);
        })
      }
      className="inline-flex items-center gap-1 text-xs text-faint transition-colors hover:text-alert disabled:opacity-50"
    >
      {pending && <Spinner className="h-3 w-3" />}
      {label}
    </button>
  );
}

export function KeyMaker() {
  const [pending, start] = useTransition();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (key) {
    return (
      <div className="mt-2 flex flex-col gap-4">
        <p className="text-sm text-muted">
          Copy this key now. For your security it&apos;s shown only once. If you lose it, make a new one.
        </p>
        <code className="break-all rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink">{key}</code>
        <button
          type="button"
          className={`${btnSecondary} self-start`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(key);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* the key above can still be selected */
            }
          }}
        >
          {copied ? "Copied" : "Copy key"}
        </button>
        <div className="rounded-2xl bg-paper p-5 text-sm leading-relaxed text-muted">
          <p className="font-medium text-ink">Then, in Terminal on your Mac:</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              Download the helper (it&apos;s a single file):{" "}
              <a href="/tapdin-texts.py" download className="font-medium text-ink underline underline-offset-4">
                tapdin-texts.py
              </a>
            </li>
            <li>
              Preview what it would send, without sending anything:
              <code className="mt-1.5 block break-all rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink">
                python3 ~/Downloads/tapdin-texts.py --key {key} --dry-run
              </code>
            </li>
            <li>
              If that looks right, start it:
              <code className="mt-1.5 block rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink">
                python3 ~/Downloads/tapdin-texts.py --watch
              </code>
            </li>
          </ol>
          <p className="mt-4">
            The first time, your Mac will ask you to allow Terminal to read Messages: System Settings, Privacy &amp;
            Security, Full Disk Access, turn on Terminal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={btnPrimary}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              setKey(await createTextKey());
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't make a key.");
            }
          })
        }
      >
        {pending && <Spinner />}
        {pending ? "Making…" : "Connect a Mac"}
      </button>
      {error && <span className="text-sm text-alert">{error}</span>}
    </div>
  );
}

export function ConversationButton({ messageId, count }: { messageId: string; count: number }) {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (summary) {
    return (
      <div className="mt-3 w-full rounded-2xl bg-paper p-4 text-sm leading-relaxed text-ink">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Whole conversation</p>
        <p className="mt-2 text-muted">{summary}</p>
        <button type="button" onClick={() => setSummary(null)} className="mt-3 text-xs text-faint hover:text-ink">
          Hide
        </button>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await summarizeConversation(messageId);
            if ("error" in result) setError(result.error);
            else setSummary(result.summary);
          })
        }
        className="inline-flex items-center gap-1.5 font-medium text-faint transition-colors hover:text-ink disabled:opacity-60"
      >
        {pending && <Spinner className="h-3 w-3" />}
        {pending ? "Summarizing…" : `Summarize the conversation (${count} texts)`}
      </button>
      {error && <span className="text-alert">{error}</span>}
    </span>
  );
}

export function PhoneSetup({ origin }: { origin: string }) {
  const [pending, start] = useTransition();
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (address) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Your private address. Tap Copy, then keep going with the steps below.</p>
        <code className="break-all rounded-xl border border-line bg-paper px-4 py-3 text-xs text-ink">{address}</code>
        <button
          type="button"
          className={`${btnPrimary} self-start`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* the address above can still be pressed and held to copy */
            }
          }}
        >
          {copied ? "Copied" : "Copy address"}
        </button>
        <p className="text-xs text-faint">Shown once. If you lose it, make a new one and disconnect the old one in Settings.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={btnPrimary}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              setAddress(`${origin}/api/ingest/t/${await createTextKey()}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't make an address.");
            }
          })
        }
      >
        {pending && <Spinner />}
        {pending ? "Making…" : "Make my private address"}
      </button>
      {error && <span className="text-sm text-alert">{error}</span>}
    </div>
  );
}

export function NameNumber({ handle }: { handle: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-medium text-faint transition-colors hover:text-ink">
        Name this number
      </button>
    );
  }
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2"
      action={(formData) =>
        start(async () => {
          setError(null);
          try {
            await nameTextNumber(handle, String(formData.get("name") ?? ""));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save that.");
          }
        })
      }
    >
      <input name="name" required maxLength={80} autoFocus placeholder="Who is this?" className={`${field} max-w-[14rem] py-2 text-sm`} />
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 font-medium text-ink disabled:opacity-60">
        {pending && <Spinner className="h-3 w-3" />}
        Save
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-faint hover:text-ink">
        Cancel
      </button>
      {error && <span className="text-alert">{error}</span>}
    </form>
  );
}

export function SuggestionsToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => start(async () => setTextSuggestions(!on))}
      className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-accent" : "bg-line"}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-card shadow transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

export function SuggestionRow({ id, label }: { id: string; label: string }) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium">{label}</p>
        {!adding && (
          <div className="flex items-center gap-4 text-sm">
            <button type="button" onClick={() => setAdding(true)} className="font-medium text-ink underline underline-offset-4">
              Add
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => resolveSuggestion(id, "ignore"))}
              className="text-faint transition-colors hover:text-ink disabled:opacity-50"
            >
              Ignore
            </button>
          </div>
        )}
      </div>
      {adding && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          action={(formData) =>
            start(async () => {
              setError(null);
              try {
                await resolveSuggestion(id, "add", String(formData.get("name") ?? ""));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't add that.");
              }
            })
          }
        >
          <input name="name" required autoFocus maxLength={80} placeholder="Who is this?" className={`${field} max-w-[14rem] py-2 text-sm`} />
          <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink disabled:opacity-60">
            {pending && <Spinner className="h-3 w-3" />}
            Save
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-sm text-faint hover:text-ink">
            Cancel
          </button>
          {error && <span className="text-sm text-alert">{error}</span>}
        </form>
      )}
    </li>
  );
}

export function CatchMeUpButton({ personKey }: { personKey: string }) {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (summary) {
    return (
      <div className="rounded-3xl bg-accent-soft px-6 py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Catch me up</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{summary}</p>
        <button type="button" onClick={() => setSummary(null)} className="mt-3 text-xs text-muted hover:text-ink">
          Hide
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={btnSecondary}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await catchMeUp(personKey);
            if ("error" in result) setError(result.error);
            else setSummary(result.summary);
          })
        }
      >
        {pending && <Spinner />}
        {pending ? "Reading…" : "Catch me up"}
      </button>
      {error && <span className="text-sm text-alert">{error}</span>}
    </div>
  );
}
