"use client";

import { useRef, useState, useTransition } from "react";
import { DictationButton, type DictationHandle } from "@/components/dictation-button";
import { Spinner } from "@/components/pending-button";

// A small inline box for replying to one comment. The caller decides where
// the reply goes; this just collects the text.
export function ReplyBox({
  onSend,
  onCancel,
}: {
  onSend: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dictationRef = useRef<DictationHandle>(null);

  function submit() {
    const value = text.trim();
    if (!value || pending) return;
    dictationRef.current?.cancel();
    setError(null);
    startTransition(async () => {
      try {
        await onSend(value);
        setText("");
        onCancel();
      } catch {
        setError("Couldn't post that reply. Try again.");
      }
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="mt-1.5 flex flex-wrap items-center gap-2"
    >
      <input
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={2000}
        placeholder="Write a reply…"
        aria-label="Reply"
        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none"
      />
      <DictationButton
        ref={dictationRef}
        className="flex-shrink-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-zinc-600 shadow-sm hover:border-zinc-400"
        getValue={() => text}
        setValue={setText}
        onError={setError}
        onStart={() => setError(null)}
        disabled={pending}
      />
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending && <Spinner />}
        {pending ? "Posting…" : "Reply"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
      >
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
