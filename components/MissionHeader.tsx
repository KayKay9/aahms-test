"use client";

import { useEffect, useState } from "react";
import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/demoScenarios";
import { worstRisk, type RiskLevel } from "@/lib/risk";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { useMissionMode } from "./MissionModeContext";

const MISSION_EPOCH = new Date("2026-01-15T00:00:00Z").getTime();

/** DDD/HH:MM:SS, the format used on mission clocks. */
function formatDayTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(d).padStart(3, "0")}/${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function dayOfYearMs(now: number) {
  const d = new Date(now);
  return now - Date.UTC(d.getUTCFullYear(), 0, 0);
}

type Channel = "visual" | "voice" | "haptic";

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  visual: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  voice: (
    <>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  haptic: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M3 9v6" />
      <path d="M21 9v6" />
    </>
  ),
};

export function MissionHeader({ crewRisks }: { crewRisks: RiskLevel[] }) {
  const { mode, setMode } = useMissionMode();
  const { scenario, setScenario } = useMissionTelemetry();
  const [now, setNow] = useState(Date.now());
  const [channels, setChannels] = useState<Record<Channel, boolean>>({
    visual: true,
    voice: true,
    haptic: true,
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const worst = worstRisk(crewRisks.length ? crewRisks : ["GREEN"]);
  const banner =
    worst === "GREEN"
      ? { text: "All systems nominal · No active C&W", cls: "text-mc-green", dot: "bg-mc-green" }
      : worst === "YELLOW"
        ? { text: "Caution · elevated crew risk indicators", cls: "text-mc-amber", dot: "bg-mc-amber" }
        : { text: "Warning · review crew vitals immediately", cls: "text-mc-red", dot: "bg-mc-red" };

  // C&W lamps per NASA-STD-3001 colour conventions.
  const lamps = [
    { label: "EMERGENCY", on: worst === "RED" && scenario.id === "solar_event", cls: "border-mc-red bg-mc-red/15 text-mc-red" },
    { label: "WARNING", on: worst === "RED", cls: "border-mc-red bg-mc-red/15 text-mc-red" },
    { label: "CAUTION", on: worst === "YELLOW", cls: "border-mc-amber bg-mc-amber/15 text-mc-amber" },
    { label: "ADVISORY", on: worst === "GREEN" && scenario.id !== "nominal", cls: "border-mc-cyan bg-mc-cyan/10 text-mc-cyan" },
  ];

  const stats = [
    { label: "Mission", value: "MTV-1 · MARS TRANSIT" },
    { label: "GMT", value: formatDayTime(dayOfYearMs(now)) },
    { label: "MET", value: formatDayTime(now - MISSION_EPOCH) },
    {
      label: "Comm",
      value: mode === "space" ? "LOS · OWLT 20m 04s" : "LINK · PWA SYNC OK",
      cls: mode === "space" ? "text-mc-amber" : "text-mc-green",
    },
  ];

  return (
    <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-mc-line bg-mc-header px-6 py-3.5">
        <div className="flex items-center gap-3.5">
          <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="16.5" fill="#0B3D91" stroke="#2A5BC0" />
            <ellipse cx="18" cy="18" rx="15" ry="6" fill="none" stroke="#FFFFFF" strokeOpacity=".55" transform="rotate(-24 18 18)" />
            <path d="M7 19h6l2-5 3 9 2.5-6H29" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[17px] font-bold tracking-[0.08em]">
              AAHMS <span className="font-mono font-medium tracking-normal text-mc-cyan">{"// EDGE AI"}</span>
            </h1>
            <p className="text-xs text-mc-label">Autonomous Astronaut Health Monitoring System</p>
          </div>
        </div>

        <dl className="flex flex-wrap items-center gap-7">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5">
              <dt className="mc-label">{s.label}</dt>
              {/* Clocks tick every second, so server and client HTML differ by design. */}
              <dd className={`font-mono text-[13px] ${s.cls ?? ""}`} suppressHydrationWarning>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex items-center gap-3">
          <div role="group" aria-label="Operating mode" className="flex rounded-lg border border-mc-line-strong bg-mc-panel p-[3px]">
            {(
              [
                ["space", "Space Mode"],
                ["earth", "Earth Mode · Rural PWA"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={`rounded-md px-3.5 py-2 text-xs ${
                  mode === id ? "bg-mc-nasa font-semibold text-white" : "font-medium text-mc-muted hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Alert channels">
            {(Object.keys(CHANNEL_ICONS) as Channel[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`${c} alerts ${channels[c] ? "on" : "off"}`}
                aria-pressed={channels[c]}
                onClick={() => setChannels((s) => ({ ...s, [c]: !s[c] }))}
                className={`flex h-9 w-9 items-center justify-center rounded-md border border-mc-line-strong bg-mc-panel ${
                  channels[c] ? "text-mc-soft" : "text-mc-label/50"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {CHANNEL_ICONS[c]}
                </svg>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mc-line bg-mc-bar px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {lamps.map((l) => (
            <span
              key={l.label}
              className={`rounded border px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-[0.1em] ${
                l.on ? l.cls : "border-[#2a3550] text-[#6b7690]"
              }`}
            >
              {l.label}
            </span>
          ))}
          <span className={`ml-2 flex items-center gap-2 text-[13px] font-semibold ${banner.cls}`}>
            <span className={`h-2 w-2 rounded-full ${banner.dot}`} />
            {banner.text}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mc-label !text-mc-amber">Demo controls</span>
          {DEMO_SCENARIOS.map((s) => {
            const active = scenario.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setScenario(s.id as DemoScenarioId)}
                aria-pressed={active}
                className={`min-h-7 whitespace-nowrap rounded-md border bg-mc-panel px-3 py-2 text-xs font-medium hover:bg-mc-raised ${
                  active ? "border-mc-green text-mc-green" : "border-mc-line-strong text-mc-soft hover:text-white"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
