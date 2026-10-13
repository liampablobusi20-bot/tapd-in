"use client";

import { useState } from "react";

export function AddToCalendar({ token }: { token: string }) {
  const [open, setOpen] = useState(false);

  function feedUrl() {
    return `${window.location.origin}/c/${token}/calendar.ics`;
  }
  function webcalUrl() {
    return feedUrl().replace(/^https?:/, "webcal:");
  }

  const buttonClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:border-zinc-400";

  return (
    <div className="mt-3" data-tour="add-to-calendar">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
      >
        Add to your calendar
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              window.open(
                `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl())}`,
                "_blank",
                "noopener"
              )
            }
          >
            Google Calendar
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              window.location.href = webcalUrl();
            }}
          >
            Apple / Outlook
          </button>
          <a href={`/c/${token}/calendar.ics`} download className={buttonClass}>
            Download .ics
          </a>
        </div>
      )}
    </div>
  );
}
