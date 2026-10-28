"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { assessRisk, describeVitals, riskLabel, type RiskLevel } from "@/lib/risk";
import { MissionHeader } from "./MissionHeader";
import { OfflineAICopilot } from "./OfflineAICopilot";
import { CrewOverview, type CrewMemberView } from "./CrewOverview";
import { VitalsMonitor, type LiveVitals } from "./VitalsMonitor";
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
  const [liveSelected, setLiveSelected] = useState<LiveVitals | null>(null);

  const inFlight = useRef(false);
  const load = useCallback(async () => {
    // Skip a poll while the previous one is still running so slow links don't pile requests up.
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) setData(await res.json());
    } catch {
      /* offline */
    } finally {
      inFlight.current = false;
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

  // One line per crew member, so the co-pilot can answer about anyone, not just the selected card.
  const crewSummary = useMemo(
    () =>
      (data?.crews ?? [])
        .flatMap((c) => c.members)
        .filter((m) => user.role === "COMMANDER" || m.user.crewId === user.crewId)
        .map((m) =>
          m.latest
            ? `${m.user.name} (${m.user.callsign}, ${m.user.crewId}): ${describeVitals({ ...m.latest, hrv: m.latest.hrv ?? 60 })}, status ${riskLabel(m.risk)}`
            : `${m.user.name} (${m.user.callsign}, ${m.user.crewId}): no readings yet`
        )
        .join("\n"),
    [data, user]
  );
  const canWrite =
    user.role === "ASTRONAUT" && selectedId === user.userId;

  const tabs = [
    { id: "telemetry", label: "Crew vitals" },
    { id: "habitat", label: "Habitat & routine" },
    { id: "pvt", label: "Cognitive test" },
    { id: "queue", label: "Sync queue", badge: unsyncedCount || undefined },
  ];

  const crewCards = (list: DashboardResponse["crews"][number]["members"], hrvDefault: number) =>
    list.map((m) => {
      const card = {
        id: m.user.id,
        name: m.user.name,
        callsign: m.user.callsign,
        heartRate: m.latest?.heartRate ?? 70,
        hrv: m.latest?.hrv ?? hrvDefault,
        risk: m.risk,
      };
      // The selected card mirrors the live readout below it.
      return liveSelected?.userId === m.user.id
        ? { ...card, heartRate: liveSelected.heartRate, hrv: liveSelected.hrv, risk: liveSelected.risk }
        : card;
    });

  return (
    <CopilotProvider>
    <div className="flex min-h-screen flex-col bg-mc-bg font-sans text-foreground">
      <SyncEngine />
      <MissionHeader crewRisks={crewRisks} />

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-6 p-4 pb-24 md:p-6 md:pb-24 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="flex min-w-0 flex-col gap-5">
          <TabBar tabs={tabs} active={tab} onChange={setTab} />

          {tab === "telemetry" && (
            <>
              <CrewOverview
                members={
                  data?.crews.find((c) => c.crewId === "MTV-1")
                    ? crewCards(data.crews.find((c) => c.crewId === "MTV-1")!.members, 60)
                    : members
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
                        members={crewCards(crew.members, 55)}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    </div>
                  ))}
              <VitalsMonitor
                userId={selectedId}
                userName={selectedMember?.name ?? user.name}
                canWrite={canWrite}
                onLive={setLiveSelected}
                serverVitals={
                  selectedServer
                    ? {
                        heartRate: selectedServer.heartRate,
                        hrv: selectedServer.hrv ?? 60,
                        spo2: selectedServer.spo2,
                        radiation: selectedServer.radiation ?? 0.075,
                      }
                    : undefined
                }
              />
            </>
          )}

          {tab === "habitat" && (
            <div className="grid gap-5 md:grid-cols-2">
              <CabinEnvironment />
              <ExerciseSleep />
            </div>
          )}
          {tab === "pvt" && <PVTTest />}
          {tab === "queue" && <StoreForwardQueue />}
        </main>

        <OfflineAICopilot
          userId={user.userId}
          userName={user.name}
          patientName={selectedMember?.name}
          crewSummary={crewSummary}
          displayVitals={
            selectedMember
              ? {
                  heartRate: selectedMember.heartRate,
                  hrv: selectedMember.hrv,
                  spo2: selectedServer?.spo2 ?? 98,
                  radiation: selectedServer?.radiation ?? 0.075,
                }
              : undefined
          }
        />
      </div>
      <CopilotFloatingLauncher />
    </div>
    </CopilotProvider>
  );
}
