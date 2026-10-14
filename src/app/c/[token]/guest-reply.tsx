"use client";

import { useState } from "react";
import { addGuestEntry } from "@/lib/actions/guest-entries";
import { ReplyBox } from "@/components/reply-box";

// Sits inline after a comment's name and time: a "Reply" link that opens a
// small box under that comment.
export function GuestReply({
  token,
  calendarItemId,
  parentId,
  defaultName,
  leadingDot = false,
}: {
  token: string;
  calendarItemId: string;
  parentId: string;
  defaultName: string;
  leadingDot?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {leadingDot && " · "}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="font-medium text-zinc-500 hover:text-zinc-900"
      >
        Reply
      </button>
      {open && (
        <span className="mt-1.5 block">
          <ReplyBox
            onCancel={() => setOpen(false)}
            onSend={async (text) => {
              const formData = new FormData();
              formData.set("body_text", text);
              formData.set("reply_to", parentId);
              formData.set("author_name", defaultName);
              await addGuestEntry(token, calendarItemId, formData);
            }}
          />
        </span>
      )}
    </>
  );
}
