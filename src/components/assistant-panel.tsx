"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DictationButton, type DictationHandle } from "@/components/dictation-button";
import {
  applyAssistantProposals,
  type ApplyResult,
} from "@/lib/actions/assistant";

type ProposalView = { proposal: unknown; summary: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  proposals?: ProposalView[];
  applied?: ApplyResult[] | "dismissed";
};

type Props =
  | { mode: "owner"; calendarId: string }
  | { mode: "guest"; token: string };

const OWNER_PROMPTS = [
  "What's coming up this week?",
  "Push everything after the next delayed item back 3 days",
  "Set up a schedule for a two-day team offsite",
  "What did we decide about budget?",
];
const GUEST_PROMPTS = ["What's coming up this week?", "What changed recently?", "What's still unscheduled?"];

export function AssistantPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, startApply] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const dictationRef = useRef<DictationHandle>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    dictationRef.current?.cancel();
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(props.mode === "owner"
            ? { calendarId: props.calendarId }
            : { token: props.token }),
          messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setMessages([
        ...next,
        { role: "assistant", content: data.reply, proposals: data.proposals ?? [] },
      ]);
    } catch {
      setError("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function apply(index: number) {
    if (props.mode !== "owner") return;
    const proposals = messages[index].proposals ?? [];
    startApply(async () => {
      try {
        const results = await applyAssistantProposals(
          props.calendarId,
          proposals.map((p) => p.proposal)
        );
        setMessages((current) =>
          current.map((m, i) => (i === index ? { ...m, applied: results } : m))
        );
      } catch {
        setError("Couldn't apply those changes. Try again.");
      }
    });
  }

  function dismiss(index: number) {
    setMessages((current) =>
      current.map((m, i) => (i === index ? { ...m, applied: "dismissed" } : m))
    );
  }

  const prompts = props.mode === "owner" ? OWNER_PROMPTS : GUEST_PROMPTS;

  return (
    <>
      {!open && (
        <button
          data-tour="assistant"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 rounded-full bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-zinc-800"
        >
          Ask AI
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Assistant"
          className="fixed inset-x-0 bottom-0 z-40 flex h-[75vh] flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[34rem] sm:w-[26rem] sm:rounded-2xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Assistant</p>
              <p className="text-xs text-zinc-500">
                {props.mode === "owner"
                  ? "You approve every change."
                  : "Ask about the schedule."}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-zinc-500">Try one of these:</p>
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => send(prompt)}
                    className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:border-zinc-400"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div className="max-w-[90%] space-y-2">
                  <p
                    className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-800"
                    }`}
                  >
                    {message.content}
                  </p>

                  {message.proposals && message.proposals.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                        Proposed changes
                      </p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-zinc-800">
                        {message.proposals.map((p, i) => (
                          <li key={i}>{p.summary}</li>
                        ))}
                      </ul>
                      {!message.applied && props.mode === "owner" && (
                        <div className="mt-2.5 flex gap-2">
                          <button
                            onClick={() => apply(index)}
                            disabled={applying}
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                          >
                            {applying ? "Applying…" : "Apply changes"}
                          </button>
                          <button
                            onClick={() => dismiss(index)}
                            disabled={applying}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-amber-100 disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                      {message.applied === "dismissed" && (
                        <p className="mt-2 text-sm text-zinc-500">Dismissed.</p>
                      )}
                      {Array.isArray(message.applied) && (
                        <ul className="mt-2 space-y-0.5 text-sm">
                          {message.applied.map((result, i) => (
                            <li key={i} className={result.ok ? "text-emerald-700" : "text-red-600"}>
                              {result.ok ? "Done: " : "Couldn't: "}
                              {result.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && <p className="text-sm text-zinc-400">Working on it…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-zinc-100 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              placeholder={
                props.mode === "owner" ? "Ask or request a change…" : "Ask about the schedule…"
              }
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
            />
            <DictationButton
              ref={dictationRef}
              getValue={() => input}
              setValue={setInput}
              onError={setError}
              onStart={() => setError(null)}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex-shrink-0 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
