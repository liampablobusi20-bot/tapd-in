"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { addGuestEntry } from "@/lib/actions/guest-entries";
import { createGuestUploadUrl } from "@/lib/actions/uploads";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { mediaTypeFor } from "@/lib/media-type";
import { MediaUploadButton } from "@/components/media-upload-button";

export function GuestEntryForm({
  token,
  calendarItemId,
  defaultName,
}: {
  token: string;
  calendarItemId: string;
  defaultName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<{
    url: string;
    type: "image" | "video" | "file";
  } | null>(
    null
  );
  const [localPreview, setLocalPreview] = useState<{
    url: string;
    type: "image" | "video" | "file";
  } | null>(null);

  const getUploadUrl = useCallback(
    (filename: string, contentType: string) =>
      createGuestUploadUrl(token, calendarItemId, filename, contentType),
    [token, calendarItemId]
  );
  const { upload, uploading, progress } = useMediaUpload(getUploadUrl);

  function clearPreview() {
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  function submitEntry(
    authorName: string,
    bodyText: string,
    uploadedMedia: typeof media
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("author_name", authorName);
        formData.set("body_text", bodyText);
        formData.set("media_url", uploadedMedia?.url ?? "");
        formData.set("media_type", uploadedMedia?.type ?? "");
        await addGuestEntry(token, calendarItemId, formData);
        setMedia(null);
        clearPreview();
        formRef.current?.reset();
      } catch {
        setError("Couldn't post that. Try again.");
      }
    });
  }

  async function handleFile(file: File) {
    setError(null);
    // Show what was picked immediately — no need to wait on the network to
    // give people an idea of what they're posting.
    setLocalPreview({ url: URL.createObjectURL(file), type: mediaTypeFor(file.type) });
    try {
      const { mediaUrl, mediaType } = await upload(file);
      const uploadedMedia = { url: mediaUrl, type: mediaType };
      setMedia(uploadedMedia);
      // Submit directly with the value we just got, instead of relying on a
      // requestAnimationFrame + hidden-input round trip — that repaint isn't
      // guaranteed to fire promptly (e.g. backgrounded tab on mobile), which
      // could strand a completed upload without ever posting it.
      const form = formRef.current;
      const authorName =
        (form?.elements.namedItem("author_name") as HTMLInputElement | null)
          ?.value ?? "";
      const bodyText =
        (form?.elements.namedItem("body_text") as HTMLInputElement | null)
          ?.value ?? "";
      submitEntry(authorName, bodyText, uploadedMedia);
    } catch (err) {
      clearPreview();
      setError(
        err instanceof Error ? err.message : "Couldn't upload that file. Try again."
      );
    }
  }

  function handleSubmit(formData: FormData) {
    submitEntry(
      String(formData.get("author_name") ?? ""),
      String(formData.get("body_text") ?? ""),
      media
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="mt-3 flex flex-col gap-2">
      <input
        type="text"
        name="author_name"
        defaultValue={defaultName}
        placeholder="Your name"
        className="rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none"
      />
      {localPreview && (
        <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5">
          {localPreview.type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={localPreview.url}
              alt=""
              className="h-10 w-10 flex-shrink-0 rounded object-cover"
            />
          )}
          {localPreview.type === "video" && (
            <video
              src={`${localPreview.url}#t=0.1`}
              className="h-10 w-10 flex-shrink-0 rounded object-cover"
              muted
              playsInline
              preload="metadata"
            />
          )}
          {localPreview.type === "file" && (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-400">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M6 2.5h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1v-17a1 1 0 011-1z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
          <span className="text-xs text-zinc-500">
            {uploading ? `Uploading… ${progress ?? 0}%` : "Posting…"}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          name="body_text"
          placeholder="Add a comment…"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
        <input type="hidden" name="media_url" value={media?.url ?? ""} />
        <input type="hidden" name="media_type" value={media?.type ?? ""} />
        <MediaUploadButton
          className="flex-shrink-0 cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-2"
          onFile={handleFile}
          disabled={uploading || pending}
        />
        <button
          type="submit"
          disabled={uploading || pending}
          className="flex-shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-base font-medium text-white disabled:opacity-50"
        >
          {uploading ? `Uploading… ${progress ?? 0}%` : pending ? "Posting…" : "Post"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
