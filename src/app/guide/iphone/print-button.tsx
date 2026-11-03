"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30"
    >
      Print or save as PDF
    </button>
  );
}
