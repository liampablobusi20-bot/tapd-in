"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SignedUpload = { path: string; token: string; mediaType: "image" | "video" };

// Uploads a file straight from the browser to Supabase Storage using a
// signed URL minted by a Server Action — the file bytes never pass through
// our own server, so they aren't subject to Vercel's request body cap.
export function useMediaUpload(
  getUploadUrl: (filename: string, contentType: string) => Promise<SignedUpload>
) {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
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
