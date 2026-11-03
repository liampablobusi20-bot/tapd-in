"use client";

import { useState, useTransition } from "react";
import { deleteAllMyData } from "@/lib/actions/account";
import { Spinner } from "@/components/pending-button";
import { field } from "@/components/ui";

export function DeleteDataForm() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) return <p className="text-sm text-accent">All of your data has been deleted.</p>;

  return (
    <div className="flex flex-col gap-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type DELETE to confirm"
        autoComplete="off"
        className={field}
      />
      {error && <p className="text-sm text-alert">{error}</p>}
      <button
        type="button"
        disabled={pending || text.trim().toUpperCase() !== "DELETE"}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await deleteAllMyData(text);
            if (result.ok) setDone(true);
            else setError(result.error);
          })
        }
        className="inline-flex items-center gap-2 self-start rounded-full bg-alert px-6 py-3 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {pending && <Spinner className="h-3.5 w-3.5" />}
        Delete all my data
      </button>
    </div>
  );
}
