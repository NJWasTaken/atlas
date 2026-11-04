import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Atlas — Find your way through knowledge", description: "All the time in the world to be curious." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
