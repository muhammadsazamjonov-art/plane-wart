import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sky Ace 3D — Havo jangi",
  description: "3D samolyot jangi: 8 xarita, 120+ samolyot, Arena 26 AI, multiplayer, PWA.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sky Ace 3D", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-512.png", apple: "/icon-512.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050b18",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <body className="bg-[#050b18] text-white antialiased">{children}</body>
    </html>
  );
}
