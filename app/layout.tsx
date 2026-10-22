import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { MissionModeProvider } from "@/components/MissionModeContext";
import { SyncProvider } from "@/components/SyncContext";
import { MissionTelemetryProvider } from "@/components/MissionTelemetryProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "AAHMS // EDGE AI",
  description: "Autonomous Astronaut Health Monitoring System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${plexMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <MissionModeProvider>
          <MissionTelemetryProvider>
            <SyncProvider>{children}</SyncProvider>
          </MissionTelemetryProvider>
        </MissionModeProvider>
      </body>
    </html>
  );
}
