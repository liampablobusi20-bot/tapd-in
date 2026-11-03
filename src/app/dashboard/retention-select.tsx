"use client";

import { useState, useTransition } from "react";
import { setRetention } from "@/lib/actions/account";
import { RETENTION_OPTIONS, retentionLabel } from "@/lib/inbox/retention";
import { Spinner } from "@/components/pending-button";

export function RetentionSelect({ days }: { days: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        defaultValue={days}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            setError(null);
            const result = await setRetention(Number(e.target.value));
            if (!result.ok) setError(result.error);
          })
        }
        className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink disabled:opacity-50"
      >
        {RETENTION_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {retentionLabel(d)}
          </option>
        ))}
      </select>
      {pending && <Spinner className="h-3.5 w-3.5" />}
      {error && <span className="text-sm text-alert">{error}</span>}
    </div>
  );
}
