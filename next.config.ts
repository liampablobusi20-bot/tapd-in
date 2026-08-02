import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows testing the dev server from another device on the same WiFi
  // (e.g. http://192.168.x.x:3001) — Next.js blocks cross-origin dev
  // requests by default, which otherwise shows a blank page. Matched
  // segment-by-segment, not as a real CIDR range — covers the common
  // home-router ranges.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // Photo/video bytes upload directly from the browser to Supabase Storage
  // via a signed URL (see src/hooks/use-media-upload.ts) — they never pass
  // through a Server Action body, which on Vercel is hard-capped around
  // 4.5MB regardless of this setting. Server Actions here only carry text.
};

export default nextConfig;
