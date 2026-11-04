import "./globals.css";
import type { Metadata } from "next";
import CelestialBackground from "./components/CelestialBackground";

export const metadata: Metadata = {
  title: "Atlas — Find your way through knowledge",
  description: "A quiet space for the things you need to learn, and everything you're curious about.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CelestialBackground />
        {children}
      </body>
    </html>
  );
}
