"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { addGuestEntry } from "@/lib/actions/guest-entries";
import { createGuestUploadUrl } from "@/lib/actions/uploads";
import { useMediaUpload } from "@/hooks/use-media-upload";
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

  const getUploadUrl = useCallback(
    (filename: string, contentType: string) =>
      createGuestUploadUrl(token, calendarItemId, filename, contentType),
    [token, calendarItemId]
  );
  const { upload, uploading } = useMediaUpload(getUploadUrl);

  async function handleFile(file: File) {
    setError(null);
    try {
      const { mediaUrl, mediaType } = await upload(file);
      setMedia({ url: mediaUrl, type: mediaType });
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't upload that file. Try again."
      );
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addGuestEntry(token, calendarItemId, formData);
        setMedia(null);
        formRef.current?.reset();
      } catch {
        setError("Couldn't post that. Try again.");
      }
    });
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
          {uploading ? "Uploading…" : pending ? "Posting…" : "Post"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
