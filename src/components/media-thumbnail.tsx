"use client";

import { useState } from "react";

// Uploaded object keys are `{36-char uuid}-{original filename}`, so the
// filename can be recovered from the public URL without a schema change.
function filenameFromUrl(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const last = path.split("/").pop() ?? "file";
    return last.length > 37 ? last.slice(37) : last;
  } catch {
    return "file";
  }
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0">
      <path
        d="M6 2.5h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1v-17a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2.5V7a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function MediaThumbnail({
  src,
  type,
  className,
}: {
  src: string;
  type: "image" | "video" | "file";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (type === "file") {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className={
          className ??
          "flex max-w-[10rem] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:border-zinc-400"
        }
      >
        <FileIcon />
        <span className="truncate">{filenameFromUrl(src)}</span>
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 shadow-sm"
        }
      >
        {type === "video" ? (
          <video src={src} className="h-full w-full object-cover" preload="metadata" muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/85 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            ✕
          </button>
          {type === "video" ? (
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  );
}
