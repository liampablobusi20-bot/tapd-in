"use client";

import { useState } from "react";

export function MediaThumbnail({
  src,
  type,
  className,
}: {
  src: string;
  type: "image" | "video";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

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
