"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/format-relative-time";

// Renders nothing on the server/first client paint (avoiding an SSR/client
// hydration mismatch, since "X minutes ago" depends on the current time)
// and fills in the real relative time right after mount.
export function RelativeTime({ date }: { date: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    // Deliberately deferred to after mount, not computed during render —
    // this value depends on the current time, so computing it eagerly
    // would produce a server/client hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(formatRelativeTime(date));
  }, [date]);

  if (!text) return null;
  return <>{text}</>;
}
