import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Allows testing the dev server from another device on the same WiFi
  // (e.g. http://192.168.x.x:3001) — Next.js blocks cross-origin dev
  // requests by default, which otherwise shows a blank page. Matched
  // segment-by-segment, not as a real CIDR range — covers the common
  // home-router ranges.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // The iPhone shortcut is a signed file; this lets Safari offer to add it.
  async headers() {
    return [
      {
        source: "/TapdIn-debug.shortcut",
        headers: [
          { key: "Content-Type", value: "application/vnd.apple.shortcut" },
          { key: "Content-Disposition", value: 'inline; filename="TapdIn-debug.shortcut"' },
        ],
      },
      {
        source: "/TapdIn.shortcut",
        headers: [
          { key: "Content-Type", value: "application/vnd.apple.shortcut" },
          { key: "Content-Disposition", value: 'inline; filename="TapdIn.shortcut"' },
        ],
      },
    ];
  },
  // The legal pages are plain HTML files in /public, served at clean URLs.
  async rewrites() {
    return [
      { source: "/privacy", destination: "/privacy.html" },
      { source: "/terms", destination: "/terms.html" },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "tapdin",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
