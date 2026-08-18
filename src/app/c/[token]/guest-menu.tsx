"use client";

import { useEffect, useRef, useState } from "react";

export function GuestMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className="text-sm font-semibold text-zinc-900">Tapd In</span>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-zinc-200 bg-white py-1.5 text-sm shadow-lg">
          <a
            href="#notify-settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-zinc-700 hover:bg-zinc-50"
          >
            Notification settings
          </a>
          <a
            href="https://tapd-in-privacy-policy.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="block px-4 py-2 text-zinc-700 hover:bg-zinc-50"
          >
            Privacy Policy
          </a>
          <a
            href="https://tapd-in-terms-of-service.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="block px-4 py-2 text-zinc-700 hover:bg-zinc-50"
          >
            Terms of Service
          </a>
        </div>
      )}
    </div>
  );
}
