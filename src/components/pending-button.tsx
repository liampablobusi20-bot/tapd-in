"use client";

import { useFormStatus } from "react-dom";

export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// A submit button that locks and shows a spinner while its form's action is
// running, so a slow save can't be triggered twice by impatient clicks.
export function PendingButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ""} inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60`}
    >
      {pending && <Spinner />}
      {pending ? pendingText : children}
    </button>
  );
}
