"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";
import { createEntry } from "@/lib/actions/entries";
import { createUploadUrl } from "@/lib/actions/uploads";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { mediaTypeFor } from "@/lib/media-type";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { MediaUploadButton } from "@/components/media-upload-button";
import { DictationButton, type DictationHandle } from "@/components/dictation-button";
import { RelativeTime } from "@/components/relative-time";
import { NoteActions } from "./note-actions";

export type Group = { id: string; name: string };

type Entry = {
  id: string;
  author_type: "owner" | "guest";
  author_label: string | null;
  body_text: string | null;
  photo_url: string | null;
  media_type: string | null;
  visible_group_ids: string[] | null;
  kind: "note" | "change";
  created_at: string;
};

export function EntriesSection({
  entries,
  calendarItemId,
  calendarId,
  groups,
}: {
  entries: Entry[];
  calendarItemId: string;
  calendarId: string;
  groups: Group[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const dictationRef = useRef<DictationHandle>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
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
      createUploadUrl(calendarId, calendarItemId, filename, contentType),
    [calendarId, calendarItemId]
  );
  const { upload, uploading, progress } = useMediaUpload(getUploadUrl);

  function clearPreview() {
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  function submitEntry(
    bodyText: string,
    uploadedMedia: typeof media,
    groupIds: string[]
  ) {
    dictationRef.current?.cancel();
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("body_text", bodyText);
        formData.set("media_url", uploadedMedia?.url ?? "");
        formData.set("media_type", uploadedMedia?.type ?? "");
        for (const id of groupIds) formData.append("visible_group_ids", id);
        await createEntry(calendarItemId, calendarId, formData);
        setMedia(null);
        clearPreview();
        // Clear only the note, not the whole form: the group checkboxes stay
        // as they were, so a run of private notes doesn't silently flip back
        // to "everyone" after the first one.
        const note = formRef.current?.elements.namedItem(
          "body_text"
        ) as HTMLInputElement | null;
        if (note) note.value = "";
      } catch {
        setError("Couldn't add that entry. Try again.");
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
      const bodyText =
        (formRef.current?.elements.namedItem("body_text") as HTMLInputElement | null)
          ?.value ?? "";
      const groupIds = formRef.current
        ? new FormData(formRef.current).getAll("visible_group_ids").map(String)
        : [];
      submitEntry(bodyText, uploadedMedia, groupIds);
    } catch (err) {
      clearPreview();
      setError(
        err instanceof Error ? err.message : "Couldn't upload that file. Try again."
      );
    }
  }

  function handleSubmit(formData: FormData) {
    submitEntry(
      String(formData.get("body_text") ?? ""),
      media,
      formData.getAll("visible_group_ids").map(String)
    );
  }

  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  const notes = entries.filter((entry) => entry.kind !== "change");
  const history = entries.filter((entry) => entry.kind === "change");
  const selectedNames = groups
    .filter((group) => selectedGroups.includes(group.id))
    .map((group) => group.name);
  const chip =
    "inline-block cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium";
  const chipOn = "border-zinc-900 bg-zinc-900 text-white";
  const chipOff = "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400";

  return (
    <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
      {history.length > 0 && (
        <details className="group mb-2.5">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-700 [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden>
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            History ({history.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1 border-l border-zinc-200 pl-3 text-xs text-zinc-500">
            {history.map((entry) => (
              <li key={entry.id}>
                {entry.body_text} · <RelativeTime date={entry.created_at} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {notes.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2.5">
          {notes.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2.5 text-sm">
              {entry.photo_url && (
                <MediaThumbnail
                  src={entry.photo_url}
                  type={
                    entry.media_type === "video" || entry.media_type === "file"
                      ? entry.media_type
                      : "image"
                  }
                />
              )}
              <div>
                {entry.body_text && <p className="text-zinc-800">{entry.body_text}</p>}
                <p className="text-xs text-zinc-500">
                  {entry.author_label} · <RelativeTime date={entry.created_at} />
                  {entry.visible_group_ids && (
                    <span className="font-medium text-amber-700">
                      {" "}
                      · Only{" "}
                      {entry.visible_group_ids
                        .map((id) => groupNames.get(id))
                        .filter(Boolean)
                        .join(", ") || "a deleted group"}
                    </span>
                  )}
                </p>
                <NoteActions note={entry} calendarId={calendarId} groups={groups} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {localPreview && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
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
            {uploading ? `Uploading… ${progress ?? 0}%` : "Adding…"}
          </span>
        </div>
      )}

      <form
        id={formId}
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
        <DictationButton
          ref={dictationRef}
          className="flex-shrink-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-zinc-600 shadow-sm hover:border-zinc-400"
          getValue={() =>
            (formRef.current?.elements.namedItem("body_text") as HTMLInputElement | null)
              ?.value ?? ""
          }
          setValue={(value) => {
            const note = formRef.current?.elements.namedItem(
              "body_text"
            ) as HTMLInputElement | null;
            if (note) note.value = value;
          }}
          onError={setError}
          onStart={() => setError(null)}
          disabled={uploading || pending}
        />
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
          {uploading ? `Uploading… ${progress ?? 0}%` : pending ? "Adding…" : "Add"}
        </button>
      </form>
      {groups.length > 0 && (
        <details className="group mt-1.5">
          <summary
            className={`inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium [&::-webkit-details-marker]:hidden ${
              selectedNames.length ? "text-amber-700" : "text-zinc-400 hover:text-zinc-700"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden>
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Visible to: {selectedNames.length ? selectedNames.join(", ") : "everyone"}
          </summary>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedGroups([])}
              className={`${chip} ${selectedGroups.length === 0 ? chipOn : chipOff}`}
            >
              Everyone
            </button>
            {groups.map((group) => (
              <label key={group.id}>
                <input
                  type="checkbox"
                  name="visible_group_ids"
                  value={group.id}
                  form={formId}
                  checked={selectedGroups.includes(group.id)}
                  onChange={() =>
                    setSelectedGroups((current) =>
                      current.includes(group.id)
                        ? current.filter((id) => id !== group.id)
                        : [...current, group.id]
                    )
                  }
                  className="peer sr-only"
                />
                <span className={`${chip} peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900/20 ${chipOff}`}>
                  {group.name}
                </span>
              </label>
            ))}
          </div>
        </details>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
