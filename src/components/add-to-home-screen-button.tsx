"use client";

import { useEffect, useRef, useState } from "react";

type Platform = "ios" | "android" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

export function AddToHomeScreenButton({ className }: { className?: string }) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlatform(detectPlatform());

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showInstructions) return;
    function onClickAway(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowInstructions(false);
      }
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [showInstructions]);

  async function handleClick() {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
      return;
    }
    setShowInstructions((v) => !v);
  }

  if (installed) {
    return (
      <p className={className ?? "text-sm text-zinc-500"}>
        Added to your home screen.
      </p>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleClick}
        className={
          className ??
          "rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        }
      >
        Add to Home Screen
      </button>
      {showInstructions && !installEvent && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-white shadow-lg">
          <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 bg-zinc-900" />
          <p className="relative">
            {platform === "ios"
              ? "Tap the Share icon in Safari, scroll down, then tap “Add to Home Screen.”"
              : "Open your browser's menu, then choose “Add to Home screen” or “Install app.”"}
          </p>
        </div>
      )}
    </div>
  );
}
