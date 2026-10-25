"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { assessRisk, type RiskLevel } from "@/lib/risk";
import { MissionHeader } from "./MissionHeader";
import { OfflineAICopilot } from "./OfflineAICopilot";
import { CrewOverview, type CrewMemberView } from "./CrewOverview";
import { VitalsMonitor } from "./VitalsMonitor";
import { CabinEnvironment } from "./CabinEnvironment";
import { ExerciseSleep } from "./ExerciseSleep";
import { PVTTest } from "./PVTTest";
import { StoreForwardQueue } from "./StoreForwardQueue";
import { SyncEngine } from "./SyncEngine";
import { TabBar } from "./ui/TabBar";
import { useSync } from "./SyncContext";
import { CopilotProvider } from "./CopilotProvider";
import { CopilotFloatingLauncher } from "./CopilotFloatingLauncher";

type DashboardResponse = {
  syncStatus: { lastSyncAt: string | null };
  crews: Array<{
    crewId: string;
    members: Array<{
      user: {
        id: string;
        name: string;
        email: string;
        callsign: string;
        crewId: string;
      };
      latest: {
        heartRate: number;
        hrv: number | null;
        spo2: number;
        radiation: number | null;
      } | null;
      risk: RiskLevel;
    }>;
  }>;
};

export function SuperAdminDashboard({ user }: { user: SessionUser }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [tab, setTab] = useState("telemetry");
  const [selectedId, setSelectedId] = useState(
    user.role === "ASTRONAUT" ? user.userId : ""
  );
  const { unsyncedCount } = useSync();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) setData(await res.json());
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, [load]);

  const members: CrewMemberView[] = useMemo(() => {
    if (!data) return [];
    const flat = data.crews.flatMap((c) => c.members);
    const filtered =
      user.role === "COMMANDER"
        ? flat
        : flat.filter((m) => m.user.crewId === user.crewId);
    return filtered.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      callsign: m.user.callsign,
      heartRate: m.latest?.heartRate ?? 70,
      hrv: m.latest?.hrv ?? 60,
      risk: m.risk,
    }));
  }, [data, user]);

  useEffect(() => {
    if (!members.length) return;
    if (!selectedId || !members.find((m) => m.id === selectedId)) {
      setSelectedId(members[0].id);
    }
  }, [members, selectedId]);

  const selectedMember = members.find((m) => m.id === selectedId);
  const selectedServer = data?.crews
    .flatMap((c) => c.members)
    .find((m) => m.user.id === selectedId)?.latest;

  const crewRisks = members.map((m) => m.risk);
  const canWrite =
    user.role === "ASTRONAUT" && selectedId === user.userId;

  const tabs = [
    { id: "telemetry", label: "Live Telemetry & Crew" },
    { id: "pvt", label: "Cognitive PVT Lab" },
    { id: "queue", label: "Store-and-Forward Queue", badge: unsyncedCount },
  ];

  return (
    <CopilotProvider>
    <div className="flex min-h-screen flex-col bg-mc-bg p-4 pb-24 font-sans text-foreground md:p-6 md:pb-24">
      <SyncEngine />
      <MissionHeader crewRisks={crewRisks} />

      <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-start">
        <OfflineAICopilot
          userId={user.userId}
          userName={user.name}
          displayVitals={
            selectedMember
              ? {
                  heartRate: selectedMember.heartRate,
                  hrv: selectedMember.hrv,
                  spo2: selectedServer?.spo2 ?? 98,
                  radiation: selectedServer?.radiation ?? 0.021,
                }
              : undefined
          }
        />

        <main className="flex min-w-0 flex-col gap-5 lg:flex-[999_1_640px]">
          <TabBar tabs={tabs} active={tab} onChange={setTab} />

          {tab === "telemetry" && (
            <>
              {user.role === "COMMANDER" && data && (
                <p className="font-mono text-[11px] text-mc-label">
                  Neon last record:{" "}
                  {data.syncStatus.lastSyncAt ?? "—"}
                </p>
              )}
              <CrewOverview
                members={
                  data?.crews.find((c) => c.crewId === "MTV-1")?.members.map((m) => ({
                    id: m.user.id,
                    name: m.user.name,
                    callsign: m.user.callsign,
                    heartRate: m.latest?.heartRate ?? 70,
                    hrv: m.latest?.hrv ?? 60,
                    risk: m.risk,
                  })) ?? members
                }
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              {user.role === "COMMANDER" &&
                data?.crews
                  .filter((c) => c.crewId !== "MTV-1")
                  .map((crew) => (
                    <div key={crew.crewId} className="space-y-2">
                      <h3 className="mc-label">Crew {crew.crewId}</h3>
                      <CrewOverview
                        members={crew.members.map((m) => ({
                          id: m.user.id,
                          name: m.user.name,
                          callsign: m.user.callsign,
                          heartRate: m.latest?.heartRate ?? 70,
                          hrv: m.latest?.hrv ?? 55,
                          risk: m.risk,
                        }))}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    </div>
                  ))}
              <VitalsMonitor
                userId={selectedId}
                userName={selectedMember?.name ?? user.name}
                canWrite={canWrite}
                serverVitals={
                  selectedServer
                    ? {
                        heartRate: selectedServer.heartRate,
                        hrv: selectedServer.hrv ?? 60,
                        spo2: selectedServer.spo2,
                        radiation: selectedServer.radiation ?? 0.021,
                      }
                    : undefined
                }
              />
              <div className="grid gap-5 md:grid-cols-2">
                <CabinEnvironment />
                <ExerciseSleep />
              </div>
            </>
          )}

          {tab === "pvt" && <PVTTest />}
          {tab === "queue" && <StoreForwardQueue />}
        </main>
      </div>
      <footer className="-mx-4 mt-auto flex flex-wrap justify-between gap-3 border-t border-mc-line px-6 pt-3 text-xs text-mc-label md:-mx-6">
        <span>C&amp;W colour coding per NASA-STD-3001 conventions: red warning · amber caution · cyan advisory · green nominal</span>
        <span>Concept prototype · not an official NASA system</span>
      </footer>
      <CopilotFloatingLauncher />
    </div>
    </CopilotProvider>
  );
}
