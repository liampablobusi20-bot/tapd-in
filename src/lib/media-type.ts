export type MediaType = "image" | "video" | "file";

export function mediaTypeFor(contentType: string): MediaType {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "file";
}
