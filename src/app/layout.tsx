import type { Metadata, Viewport } from "next";
import "@/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lantern",
  description: "Community-reported lighting and safety for walking at night, Port Harcourt.",
};

// DESIGN_SYSTEM.md: never disable pinch-zoom — it's an accessibility
// requirement, not a nicety. userScalable defaults to allowed; do not set
// maximumScale: 1 or userScalable: false here.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly)
          inject attributes like data-gr-ext-installed onto <body> before
          React hydrates — a false-positive mismatch, not a real bug. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
