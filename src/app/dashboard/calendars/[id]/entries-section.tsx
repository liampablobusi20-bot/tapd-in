"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { createEntry } from "@/lib/actions/entries";
import { createUploadUrl } from "@/lib/actions/uploads";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { MediaUploadButton } from "@/components/media-upload-button";

type Entry = {
  id: string;
  author_label: string | null;
  body_text: string | null;
  photo_url: string | null;
  media_type: string | null;
  created_at: string;
};

export function EntriesSection({
  entries,
  calendarItemId,
  calendarId,
}: {
  entries: Entry[];
  calendarItemId: string;
  calendarId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<{ url: string; type: "image" | "video" } | null>(
    null
  );

  const getUploadUrl = useCallback(
    (filename: string, contentType: string) =>
      createUploadUrl(calendarId, calendarItemId, filename, contentType),
    [calendarId, calendarItemId]
  );
  const { upload, uploading } = useMediaUpload(getUploadUrl);

  async function handleFile(file: File) {
    setError(null);
    try {
      const { mediaUrl, mediaType } = await upload(file);
      setMedia({ url: mediaUrl, type: mediaType });
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    } catch {
      setError("Couldn't upload that file. Try again.");
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createEntry(calendarItemId, calendarId, formData);
        setMedia(null);
        formRef.current?.reset();
      } catch {
        setError("Couldn't add that entry. Try again.");
      }
    });
  }

  return (
    <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
      {entries.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2.5 text-sm">
              {entry.photo_url && (
                <MediaThumbnail
                  src={entry.photo_url}
                  type={entry.media_type === "video" ? "video" : "image"}
                />
              )}
              <div>
                {entry.body_text && (
                  <p className="text-zinc-800">{entry.body_text}</p>
                )}
                <p className="text-xs text-zinc-500">
                  {entry.author_label} ·{" "}
                  {new Date(entry.created_at).toLocaleString("en-US")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={handleSubmit}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="text"
          name="body_text"
          placeholder="Add a note…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none"
        />
        <input type="hidden" name="media_url" value={media?.url ?? ""} />
        <input type="hidden" name="media_type" value={media?.type ?? ""} />
        <MediaUploadButton
          className="flex-shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-zinc-600 shadow-sm hover:border-zinc-400"
          onFile={handleFile}
          disabled={uploading || pending}
        />
        <button
          type="submit"
          disabled={uploading || pending}
          className="flex-shrink-0 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : pending ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
