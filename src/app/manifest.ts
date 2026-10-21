import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tapd In",
    short_name: "Tapd In",
    description: "A weekly briefing from your Outlook email and the texts you choose.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#24433a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
