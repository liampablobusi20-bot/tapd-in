"use client";

import { useRef, useState, useTransition } from "react";
import { addTextContact, createTextKey, removeTextContact, revokeTextKey } from "@/lib/actions/texts";
import { disconnectEmail } from "@/lib/actions/connections";
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

export function RemoveItem({ id, kind, label }: { id: string; kind: "contact" | "key" | "connection"; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (kind === "contact") await removeTextContact(id);
          else if (kind === "key") await revokeTextKey(id);
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
