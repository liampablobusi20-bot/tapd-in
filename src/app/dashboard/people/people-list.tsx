"use client";

import { useState } from "react";
import Link from "next/link";
import { field } from "@/components/ui";

export type PersonRow = { key: string; name: string; meta: string; waiting: number };

const FIRST = 25;

export function PeopleList({ people }: { people: PersonRow[] }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);

  const matches = people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const shown = all || query ? matches : matches.slice(0, FIRST);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people"
        aria-label="Search people"
        className={`${field} max-w-sm`}
      />
      <ul className="mt-6 divide-y divide-line rounded-3xl border border-line bg-card px-6 sm:px-8">
        {shown.map((p) => (
          <li key={p.key}>
            <Link href={`/dashboard/people/${encodeURIComponent(p.key)}`} className="flex items-center gap-4 py-4">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {p.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "#"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-sm text-muted">{p.meta}</span>
              </span>
              {p.waiting > 0 && (
                <span className="flex-none rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">{p.waiting} waiting</span>
              )}
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="py-6 text-sm text-muted">No one matches that.</li>}
      </ul>
      {!all && !query && matches.length > FIRST && (
        <button type="button" onClick={() => setAll(true)} className="mt-4 text-sm font-medium text-muted hover:text-ink">
          Show all {matches.length}
        </button>
      )}
    </div>
  );
}
