"use client";

import { useState, useTransition } from "react";
import { resetTwoStep, sendTestAlert, setInboxEnabled } from "@/lib/actions/admin";
import { Spinner } from "@/components/pending-button";

export function EnableButton({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setInboxEnabled(id, !enabled))}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
        enabled ? "border border-line text-muted hover:text-alert" : "bg-accent text-paper hover:opacity-90"
      }`}
    >
      {pending && <Spinner className="h-3 w-3" />}
      {enabled ? "Switch off" : "Switch on"}
    </button>
  );
}

export function TestAlertButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await sendTestAlert()))}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4 transition-opacity hover:opacity-70 disabled:opacity-50"
      >
        {pending && <Spinner className="h-3 w-3" />}
        Send me a test alert
      </button>
      {result && <span className={`text-sm ${result.ok ? "text-accent" : "text-alert"}`}>{result.message}</span>}
    </div>
  );
}

export function ResetTwoStepButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Reset two-step sign-in for this person? Only do this after confirming it's really them.")) start(() => resetTwoStep(id));
      }}
      className="inline-flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-alert disabled:opacity-50"
    >
      {pending && <Spinner className="h-3 w-3" />}
      Reset
    </button>
  );
}
