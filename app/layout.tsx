import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/game/ui/ui.css";

export const metadata: Metadata = {
  title: "Dreamflight",
  description:
    "A NiGHTS-into-Dreams-inspired 2.5D flight experience for the browser. An educational fan recreation with fully original procedural assets.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2a1a4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
