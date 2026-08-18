"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SignedUpload = {
  path: string;
  token: string;
  mediaType: "image" | "video" | "file";
};

const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB — matches the Supabase bucket limit

// Uploads a file straight from the browser to Supabase Storage using a
// signed URL minted by a Server Action — the file bytes never pass through
// our own server, so they aren't subject to Vercel's request body cap.
export function useMediaUpload(
  getUploadUrl: (filename: string, contentType: string) => Promise<SignedUpload>
) {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("That file is too large — the limit is 300MB.");
      }
      setUploading(true);
      try {
        const { path, token, mediaType } = await getUploadUrl(file.name, file.type);
        const supabase = createClient();
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
      }
    },
    [getUploadUrl]
  );

  return { upload, uploading };
}
