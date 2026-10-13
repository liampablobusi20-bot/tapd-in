"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";

type RecognitionEvent = {
  results: ArrayLike<{ 0: { transcript: string } }>;
};
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const subscribe = () => () => {};
const isSupported = () => recognitionConstructor() !== null;
const notSupportedOnServer = () => false;

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
  "audio-capture": "No microphone was found.",
  network: "Dictation needs an internet connection.",
};

export type DictationHandle = {
  // Stop right now and throw away anything the browser hasn't delivered yet,
  // so words still in flight can't land in a field that was just sent/cleared.
  cancel: () => void;
};

// Keeps listening until you tap stop. Browsers end a recognition session on
// their own after a pause or a time limit, so a session that ends while the
// person still wants to dictate is restarted, and each restart keeps the text
// already in the field. It gives up after two quiet sessions in a row.
const MAX_SILENT_SESSIONS = 2;
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network"]);

// Speech to text using the browser's own recognition (Chrome, Edge, Safari).
// Hidden where the browser doesn't offer it. Text is typed into the field for
// the person to review; nothing is sent automatically.
export function DictationButton({
  getValue,
  setValue,
  onError,
  onStart,
  disabled,
  ref,
  className = "flex-shrink-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-zinc-600 hover:border-zinc-400",
}: {
  getValue: () => string;
  setValue: (value: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  disabled?: boolean;
  ref?: Ref<DictationHandle>;
  className?: string;
}) {
  const supported = useSyncExternalStore(subscribe, isSupported, notSupportedOnServer);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const wantListeningRef = useRef(false);
  const silentSessionsRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restarts happen on a timer, long after the render that started them, so
  // they must read the latest props rather than the ones they closed over.
  const latest = useRef({ getValue, setValue, onError });
  useEffect(() => {
    latest.current = { getValue, setValue, onError };
  });

  useImperativeHandle(ref, () => ({ cancel: () => cancelListening() }));

  useEffect(
    () => () => {
      wantListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognitionRef.current?.abort();
    },
    []
  );

  if (!supported) return null;

  function cancelListening() {
    wantListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
    setListening(false);
  }

  function stopListening() {
    wantListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    setListening(false);
  }

  function beginSession() {
    const Ctor = recognitionConstructor();
    if (!Ctor) return stopListening();

    const base = latest.current.getValue().trim();
    const startedAt = Date.now();
    let heardSpeech = false;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!transcript) return;
      heardSpeech = true;
      silentSessionsRef.current = 0;
      latest.current.setValue(base ? `${base} ${transcript}` : transcript);
    };
    recognition.onerror = (event) => {
      if (FATAL_ERRORS.has(event.error)) {
        stopListening();
        latest.current.onError?.(ERROR_MESSAGES[event.error] ?? "Dictation stopped unexpectedly.");
      }
    };
    recognition.onend = () => {
      if (!wantListeningRef.current) return setListening(false);
      if (!heardSpeech && Date.now() - startedAt < 15000) silentSessionsRef.current += 1;
      if (silentSessionsRef.current >= MAX_SILENT_SESSIONS) return stopListening();
      restartTimerRef.current = setTimeout(() => {
        if (!wantListeningRef.current) return;
        try {
          beginSession();
        } catch {
          stopListening();
        }
      }, 250);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function toggle() {
    if (listening) {
      stopListening();
      recognitionRef.current?.stop();
      return;
    }
    silentSessionsRef.current = 0;
    wantListeningRef.current = true;
    try {
      beginSession();
      onStart?.();
      setListening(true);
    } catch {
      stopListening();
      onError?.("Couldn't start dictation. Try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictation" : "Start dictation"}
      title={listening ? "Stop dictation" : "Dictate"}
      className={`${className} disabled:opacity-50 ${
        listening ? "animate-pulse !border-red-300 !bg-red-50 !text-red-600" : ""
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
