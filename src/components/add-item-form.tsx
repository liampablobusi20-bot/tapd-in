"use client";

import { createItem } from "@/lib/actions/calendar-items";
import { PendingButton } from "@/components/pending-button";

export const ADD_BUTTON_CLASS =
  "rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400";
export const ADD_LINK_CLASS = "text-sm font-medium text-zinc-600 hover:text-zinc-900";

export function AddItemForm({
  calendarId,
  dateKey = null,
  className = ADD_BUTTON_CLASS,
  children,
}: {
  calendarId: string;
  dateKey?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={createItem.bind(null, calendarId, dateKey)}>
      <PendingButton pendingText="Adding…" className={className}>
        {children}
      </PendingButton>
    </form>
  );
}
