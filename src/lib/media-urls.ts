import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "entry-photos";
const DEFAULT_EXPIRY_SECONDS = 2 * 60 * 60;

// Stored links look like .../object/public/entry-photos/<calendar>/<item>/<file>.
// The part after the bucket name is the file's path, which is all we need to
// hand out a fresh, expiring link.
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const rest = url.slice(index + marker.length).split("?")[0];
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

// Swaps each stored photo/file link for a signed one that stops working after
// a couple of hours. Only call this with entries the viewer is already allowed
// to see, so links are never minted for restricted media. If signing fails the
// original link is kept, which still works while the storage is public.
export async function signEntryMedia<T extends { photo_url: string | null }>(
  entries: T[],
  expiresInSeconds = DEFAULT_EXPIRY_SECONDS
): Promise<T[]> {
  const paths = [
    ...new Set(
      entries
        .map((entry) => storagePathFromUrl(entry.photo_url))
        .filter((path): path is string => path !== null)
    ),
  ];
  if (!paths.length) return entries;

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error || !data) {
    console.error("signing media links failed:", error?.message);
    return entries;
  }

  const signed = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }

  return entries.map((entry) => {
    const path = storagePathFromUrl(entry.photo_url);
    const url = path ? signed.get(path) : undefined;
    return url ? { ...entry, photo_url: url } : entry;
  });
}

export async function removeEntryMedia(photoUrl: string | null | undefined) {
  const path = storagePathFromUrl(photoUrl);
  if (!path) return;
  const { error } = await createAdminClient().storage.from(BUCKET).remove([path]);
  if (error) console.error("removing media failed:", error.message);
}
