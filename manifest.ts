import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sky Ace 3D",
    short_name: "SkyAce",
    description: "3D havo jangi o'yini",
    start_url: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#050b18",
    theme_color: "#050b18",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
  };
}
