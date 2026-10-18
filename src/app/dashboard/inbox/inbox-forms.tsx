"use client";

import { useRef, useState, useTransition } from "react";
import {
  addCategory,
  addSampleMessage,
  deleteCategory,
  deleteInboxMessage,
  sendTestDigest,
} from "@/lib/actions/inbox";
import { PendingButton, Spinner } from "@/components/pending-button";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none";
const primary =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800";

export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-900">{address}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked: the address is selectable above */
          }
        }}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function CategoryForm() {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (formData) => {
        await addCategory(formData);
        ref.current?.reset();
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <input name="name" required maxLength={60} placeholder="Name, e.g. Clients" className={input} />
      <input
        name="description"
        maxLength={300}
        placeholder="What belongs here, e.g. customers and prospects"
        className={input}
      />
      <PendingButton pendingText="Adding…" className={`${primary} self-start`}>
        Add category
      </PendingButton>
    </form>
  );
}

export function SampleForm() {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (formData) => {
        await addSampleMessage(formData);
        ref.current?.reset();
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="sender" maxLength={80} placeholder="From (name)" className={input} />
        <input name="subject" maxLength={200} placeholder="Subject" className={input} />
      </div>
      <textarea
        name="body"
        required
        rows={4}
        maxLength={5000}
        placeholder="Paste an email or text here…"
        className={input}
      />
      <PendingButton pendingText="Sorting…" className={`${primary} self-start`}>
        Sort this message
      </PendingButton>
    </form>
  );
}

export function TestDigestButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            try {
              const r = await sendTestDigest();
              setResult(r?.status === "sent" ? "Sent. Check your email." : "Couldn't send. Try again.");
            } catch {
              setResult("Couldn't send. Try again.");
            }
          })
        }
        className={`${primary} inline-flex items-center gap-2 disabled:opacity-60`}
      >
        {pending && <Spinner />}
        {pending ? "Sending…" : "Email me this week's update"}
      </button>
      {result && <span className="text-sm text-zinc-600">{result}</span>}
    </div>
  );
}

export function RemoveButton({
  id,
  kind,
  label,
}: {
  id: string;
  kind: "category" | "message";
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={label}
      onClick={() =>
        start(async () => {
          if (kind === "category") await deleteCategory(id);
          else await deleteInboxMessage(id);
        })
      }
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {pending && <Spinner className="h-3 w-3" />}
      {label}
    </button>
  );
}
