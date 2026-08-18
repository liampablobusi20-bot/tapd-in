"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const planLabels: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  founding_local: "Founding Local",
};

const statusLabels: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

const statusColors: Record<string, string> = {
  trialing: "text-amber-700 bg-amber-50",
  active: "text-emerald-700 bg-emerald-50",
  past_due: "text-red-700 bg-red-50",
  canceled: "text-zinc-500 bg-zinc-100",
};

export function DashboardMenu({
  plan,
  subscriptionStatus,
}: {
  plan: string;
  subscriptionStatus: string;
}) {
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
      <Link href="/dashboard" className="text-lg font-semibold text-zinc-900">
        Tapd In
      </Link>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-zinc-200 bg-white py-1.5 text-sm shadow-lg">
          <div className="px-4 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Subscription
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="font-medium text-zinc-900">
                {planLabels[plan] ?? plan}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  statusColors[subscriptionStatus] ?? "text-zinc-500 bg-zinc-100"
                }`}
              >
                {statusLabels[subscriptionStatus] ?? subscriptionStatus}
              </span>
            </div>
          </div>
          <div className="my-1.5 border-t border-zinc-100" />
          <a
            href="mailto:liampablobusi20@gmail.com?subject=Tapd%20In%20subscription"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-zinc-700 hover:bg-zinc-50"
          >
            Manage subscription
          </a>
        </div>
      )}
    </div>
  );
}
