import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows testing the dev server from another device on the same WiFi
  // (e.g. http://192.168.x.x:3001) — Next.js blocks cross-origin dev
  // requests by default, which otherwise shows a blank page. Matched
  // segment-by-segment, not as a real CIDR range — covers the common
  // home-router ranges.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // Photo/video uploads go straight through a Server Action (createEntry /
  // addGuestEntry), which Next.js caps at 1MB by default — comfortably
  // fits a phone photo but not a video clip. Raised to fit both.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
