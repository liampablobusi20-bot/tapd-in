"use client";

import { useState, useTransition } from "react";
import { openBillingPortal, startCheckout } from "@/lib/actions/billing";
import { Spinner } from "@/components/pending-button";
import { btnPrimary } from "@/components/ui";

// Sends the person to a Stripe-hosted page. Nothing about a card is ever handled by Tapd In.
export function PayButton({ kind, label, className }: { kind: "checkout" | "portal"; label: string; className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = kind === "checkout" ? await startCheckout() : await openBillingPortal();
            if (result.ok) window.location.href = result.url;
            else setError(result.error);
          })
        }
        className={`${className ?? btnPrimary} inline-flex items-center gap-2 disabled:opacity-60`}
      >
        {pending && <Spinner className="h-3.5 w-3.5" />}
        {label}
      </button>
      {error && <p className="mt-2 text-sm text-alert">{error}</p>}
    </div>
  );
}
