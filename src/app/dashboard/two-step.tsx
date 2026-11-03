"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disableTwoStep, finishTwoStep, startTwoStep } from "@/lib/actions/two-step";
import { Spinner } from "@/components/pending-button";
import { btnPrimary, field } from "@/components/ui";

type Setup = { factorId: string; qr: string; secret: string };

export function TwoStepCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSetup(null);
    setTurningOff(false);
    setCode("");
    setError(null);
  };

  if (enabled && !turningOff) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium text-accent">Two-step sign-in is on</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
            You enter a 6-digit code from your authenticator app each time you log in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTurningOff(true)}
          className="text-xs text-faint transition-colors hover:text-alert"
        >
          Turn off
        </button>
      </div>
    );
  }

  if (enabled && turningOff) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Enter a current code from your authenticator app to turn two-step sign-in off.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="6-digit code"
          className={field}
        />
        {error && <p className="text-sm text-alert">{error}</p>}
        <div className="flex items-center gap-5">
          <button
            type="button"
            disabled={pending || code.trim().length < 6}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await disableTwoStep(code);
                if (result.ok) {
                  reset();
                  router.refresh();
                } else setError(result.error);
              })
            }
            className="inline-flex items-center gap-2 rounded-full bg-alert px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            Turn off
          </button>
          <button type="button" onClick={reset} className="text-sm text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!setup) {
    return (
      <div>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          Adds a 6-digit code from an authenticator app to your password, so a stolen password isn&apos;t enough to read your briefing.
        </p>
        {error && <p className="mt-3 text-sm text-alert">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await startTwoStep();
              if (result.ok) setSetup(result);
              else setError(result.error);
            })
          }
          className={`${btnPrimary} mt-5 inline-flex items-center gap-2 disabled:opacity-50`}
        >
          {pending && <Spinner className="h-3.5 w-3.5" />}
          Set up two-step sign-in
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex max-w-md list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-muted">
        <li>
          Open an authenticator app (Google Authenticator, Microsoft Authenticator, or 1Password) and add an account by scanning this code.
        </li>
        <li>Type the 6-digit code it shows, below.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="QR code to scan with your authenticator app" width={176} height={176} className="rounded-xl border border-line bg-white p-2" />
      <p className="max-w-md break-all text-xs text-muted">
        Can&apos;t scan? Enter this key instead: <code className="text-ink">{setup.secret}</code>
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="6-digit code"
        className={field}
      />
      {error && <p className="text-sm text-alert">{error}</p>}
      <p className="max-w-md text-xs leading-relaxed text-faint">
        There are no backup codes. If you lose your phone, contact us and we&apos;ll reset it after confirming it&apos;s you.
      </p>
      <div className="flex items-center gap-5">
        <button
          type="button"
          disabled={pending || code.trim().length < 6}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await finishTwoStep(setup.factorId, code);
              if (result.ok) {
                reset();
                router.refresh();
              } else setError(result.error);
            })
          }
          className={`${btnPrimary} inline-flex items-center gap-2 disabled:opacity-50`}
        >
          {pending && <Spinner className="h-3.5 w-3.5" />}
          Turn on
        </button>
        <button type="button" onClick={reset} className="text-sm text-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
