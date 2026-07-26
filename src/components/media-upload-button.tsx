"use client";

export function MediaUploadButton({ className }: { className?: string }) {
  return (
    <label
      className={
        className ??
        "flex-shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-zinc-600 shadow-sm hover:border-zinc-400"
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="8" cy="9" r="1.5" fill="currentColor" />
        <path
          d="M3 17L7.5 12L11.5 16L15 12.5L21 18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <input
        type="file"
        name="media"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.currentTarget.files && e.currentTarget.files.length > 0) {
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
    </label>
  );
}
