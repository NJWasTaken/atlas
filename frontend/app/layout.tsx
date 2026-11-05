import "./globals.css";
import "../atlas-calendar-styles.css";
import "../academics-readable.css";
import "../academics-workspace.css";
import type { Metadata } from "next";
import CelestialBackground from "./components/CelestialBackground";

export const metadata: Metadata = {
  title: "Atlas",
  description: "yk cuz its like youre mapping your knowledge or smn",
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
