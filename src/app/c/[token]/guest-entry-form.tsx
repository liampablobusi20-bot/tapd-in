"use client";

import { addGuestEntry } from "@/lib/actions/guest-entries";
import { MediaUploadButton } from "@/components/media-upload-button";

export function GuestEntryForm({
  token,
  calendarItemId,
  defaultName,
}: {
  token: string;
  calendarItemId: string;
  defaultName: string;
}) {
  return (
    <form
      action={addGuestEntry.bind(null, token, calendarItemId)}
      className="mt-3 flex flex-col gap-2"
    >
      <input
        type="text"
        name="author_name"
        defaultValue={defaultName}
        placeholder="Your name"
        className="rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <input
          type="text"
          name="body_text"
          placeholder="Add a comment…"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
        <MediaUploadButton className="flex-shrink-0 cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-2" />
        <button
          type="submit"
          className="flex-shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-base font-medium text-white"
        >
          Post
        </button>
      </div>
    </form>
  );
}
