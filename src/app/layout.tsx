import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UncleBook · Share like it's 2009",
  description:
    "A tiny social network that resurrects the Facebook uncle photo. An AI judge checks every photo before it's shared. Built with Kiro for Kiroween 2026.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
