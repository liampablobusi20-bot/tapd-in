"use client";

import { useRef, useState, useTransition } from "react";
import { addCategory, deleteCategory, deleteInboxMessage, sendTestDigest, updateName } from "@/lib/actions/inbox";
import { PendingButton, Spinner } from "@/components/pending-button";
import { btnPrimary, btnSecondary, field } from "@/components/ui";

export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <code className="break-all rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink">
        {address}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked: the address above can still be selected */
          }
        }}
        className={btnSecondary}
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
      className="mt-6 flex flex-col gap-3 border-t border-line pt-6"
    >
      <input name="name" required maxLength={60} placeholder="Topic name, e.g. Clients" className={field} />
      <input
        name="description"
        maxLength={300}
        placeholder="What belongs here, e.g. customers and prospects"
        className={field}
      />
      <PendingButton pendingText="Adding…" className={`${btnPrimary} self-start`}>
        Add topic
      </PendingButton>
    </form>
  );
}

export function NameForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form action={updateName} className="flex flex-wrap items-center gap-3">
      <input
        name="name"
        defaultValue={defaultValue}
        maxLength={60}
        placeholder="Your name"
        className={`${field} max-w-xs`}
      />
      <PendingButton pendingText="Saving…" className={btnSecondary}>
        Save
      </PendingButton>
    </form>
  );
}

export function TestDigestButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
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
        className={btnSecondary}
      >
        {pending && <Spinner />}
        {pending ? "Sending…" : "Email me this week"}
      </button>
      {result && <span className="text-sm text-muted">{result}</span>}
    </div>
  );
}

export function RemoveButton({
  id,
  kind,
  label,
  className = "",
}: {
  id: string;
  kind: "category" | "message";
  label: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (kind === "category") await deleteCategory(id);
          else await deleteInboxMessage(id);
        })
      }
      className={`inline-flex items-center gap-1 transition-colors hover:text-alert disabled:opacity-50 ${className}`}
    >
      {pending && <Spinner className="h-3 w-3" />}
      {label}
    </button>
  );
}
