"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SignedUpload = {
  path: string;
  token: string;
  mediaType: "image" | "video" | "file";
};

const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB — matches the Supabase bucket limit

// A fetch() implementation backed by XMLHttpRequest so we can observe
// upload progress (the fetch API has no upload progress event). Only used
// for the actual signed-URL PUT, so it only needs to faithfully replicate
// what storage-js's own request looks like — same method/url/headers/body,
// just executed via XHR instead of fetch.
function fetchWithProgress(onProgress: (fraction: number) => void): typeof fetch {
  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = typeof input === "string" ? input : input.toString();
      xhr.open(init?.method ?? "GET", url, true);

      const isFormData =
        typeof FormData !== "undefined" && init?.body instanceof FormData;
      new Headers(init?.headers).forEach((value, key) => {
        // Let the browser set its own multipart boundary for FormData bodies
        // instead of copying through whatever content-type header was built
        // for a plain fetch call — a mismatched one would break the upload.
        if (isFormData && key.toLowerCase() === "content-type") return;
        xhr.setRequestHeader(key, value);
      });

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        resolve(new Response(xhr.response, { status: xhr.status, statusText: xhr.statusText }));
      };
      xhr.onerror = () => reject(new TypeError("Network request failed"));
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

      xhr.responseType = "text";
      xhr.send((init?.body as XMLHttpRequestBodyInit) ?? null);
    });
}

// Uploads a file straight from the browser to Supabase Storage using a
// signed URL minted by a Server Action — the file bytes never pass through
// our own server, so they aren't subject to Vercel's request body cap.
export function useMediaUpload(
  getUploadUrl: (filename: string, contentType: string) => Promise<SignedUpload>
) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("That file is too large — the limit is 300MB.");
      }
      setUploading(true);
      setProgress(0);
      try {
        const { path, token, mediaType } = await getUploadUrl(file.name, file.type);
        const supabase = createClient(
          fetchWithProgress((fraction) => setProgress(Math.round(fraction * 100)))
        );
        const { error } = await supabase.storage
          .from("entry-photos")
          .uploadToSignedUrl(path, token, file);
        if (error) throw error;

        const {
          data: { publicUrl },
        } = supabase.storage.from("entry-photos").getPublicUrl(path);
        return { mediaUrl: publicUrl, mediaType };
      } finally {
        setUploading(false);
        setProgress(null);
      }
    },
    [getUploadUrl]
  );

  return { upload, uploading, progress };
}
