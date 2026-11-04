"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importContacts, previewContactImport, removeAllContacts, type ImportPreview } from "@/lib/actions/texts";
import { Spinner } from "@/components/pending-button";
import { btnPrimary, field } from "@/components/ui";

const small = "inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-50";

export function ContactImportForm({ mode }: { mode: "private" | "easy" }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Extract<ImportPreview, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const check = () =>
    start(async () => {
      setError(null);
      setDone(null);
      const result = await previewContactImport(text);
      if (result.ok) setPreview(result);
      else {
        setPreview(null);
        setError(result.error);
      }
    });

  const add = () =>
    start(async () => {
      setError(null);
      const result = await importContacts(text);
      if (result.ok) {
        setDone(
          result.added === 0
            ? "Everyone in that list was already on your list."
            : `Added ${result.added} ${result.added === 1 ? "person" : "people"}.${result.alreadyOnList ? ` ${result.alreadyOnList} were already on your list.` : ""}`
        );
        setText("");
        setPreview(null);
        router.refresh();
      } else setError(result.error);
    });

  return (
    <details className="mt-6 border-t border-line pt-6">
      <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">Add many people at once</summary>
      <div className="mt-4 flex flex-col gap-3">
        <p className="max-w-lg text-sm leading-relaxed text-muted">
          Paste one person per line, such as a column from a spreadsheet. A name is optional. Numbers can be written any way.
          {mode === "easy" ? " Anyone on this list has their texts kept." : ""}
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
            setDone(null);
          }}
          rows={7}
          placeholder={"Dana Ruiz, 520-555-0123\n(520) 555-0199\nPat Quinn  pat@icloud.com"}
          className={`${field} w-full font-mono text-xs`}
        />
        {error && <p className="text-sm text-alert">{error}</p>}
        {done && <p className="text-sm text-accent">{done}</p>}

        {preview && (
          <div className="rounded-2xl bg-accent-soft px-5 py-4 text-sm text-accent">
            <p className="font-medium">
              Ready to add {preview.toAdd} {preview.toAdd === 1 ? "person" : "people"}.
            </p>
            {preview.alreadyOnList > 0 && <p className="mt-1">{preview.alreadyOnList} already on your list (they keep their current names).</p>}
            {preview.duplicates > 0 && <p className="mt-1">{preview.duplicates} repeated in your paste.</p>}
            {preview.sample.length > 0 && (
              <ul className="mt-2 text-xs">
                {preview.sample.map((s) => (
                  <li key={s.number}>
                    {s.name === s.number ? s.number : `${s.name} · ${s.number}`}
                  </li>
                ))}
                {preview.toAdd > preview.sample.length && <li>…and {preview.toAdd - preview.sample.length} more</li>}
              </ul>
            )}
            {preview.skipped.length > 0 && (
              <div className="mt-3 text-alert">
                <p className="font-medium">Skipped {preview.skipped.length}{preview.skipped.length === 5 ? " or more" : ""} lines with no usable number:</p>
                <ul className="mt-1 text-xs">
                  {preview.skipped.map((s) => (
                    <li key={s.line}>
                      Line {s.line}: {s.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {preview && preview.toAdd > 0 ? (
            <button type="button" disabled={pending} onClick={add} className={`${btnPrimary} inline-flex items-center gap-2 disabled:opacity-60`}>
              {pending && <Spinner className="h-3.5 w-3.5" />}
              Add {preview.toAdd} {preview.toAdd === 1 ? "person" : "people"}
            </button>
          ) : (
            <button type="button" disabled={pending || !text.trim()} onClick={check} className={`${btnPrimary} inline-flex items-center gap-2 disabled:opacity-50`}>
              {pending && <Spinner className="h-3.5 w-3.5" />}
              Check list
            </button>
          )}
          {preview && (
            <button type="button" onClick={() => setPreview(null)} className="text-sm text-muted hover:text-ink">
              Edit list
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

export function RemoveEveryone({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (count < 2) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Remove all ${count} people from your list? Their past texts stay in your briefing, but new texts from them will no longer be kept.`)) {
          start(async () => {
            await removeAllContacts();
            router.refresh();
          });
        }
      }}
      className={`${small} text-faint hover:text-alert`}
    >
      {pending && <Spinner className="h-3 w-3" />}Remove everyone
    </button>
  );
}
