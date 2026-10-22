import type { Metadata } from "next";
import "./globals.css";
import { MissionModeProvider } from "@/components/MissionModeContext";
import { SyncProvider } from "@/components/SyncContext";
import { MissionTelemetryProvider } from "@/components/MissionTelemetryProvider";

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
    <html lang="en" className="dark">
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
