"use client";

import { useEffect, useState } from "react";
import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/demoScenarios";
import { worstRisk, type RiskLevel } from "@/lib/risk";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { useMissionMode } from "./MissionModeContext";

const MISSION_EPOCH = new Date("2026-01-15T00:00:00Z").getTime();

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}/${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function MissionHeader({ crewRisks }: { crewRisks: RiskLevel[] }) {
  const { mode, setMode } = useMissionMode();
  const { setScenario } = useMissionTelemetry();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const gmt = new Date(now);
  const metMs = now - MISSION_EPOCH;
  const worst = worstRisk(crewRisks.length ? crewRisks : ["GREEN"]);
  const cwBanner =
    worst === "GREEN"
      ? "All systems nominal · No active C&W"
      : worst === "YELLOW"
        ? "Caution — elevated crew risk indicators"
        : "Warning — review crew vitals immediately";

  return (
    <header className="space-y-3 border-b border-cyan-900/40 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-cyan-100">
            AAHMS // EDGE AI
          </h1>
          <p className="text-xs text-slate-500">
            Autonomous Astronaut Health Monitoring System
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
          <span className="rounded border border-cyan-900/50 px-2 py-1">
            MISSION: MTV-1 · MARS TRANSIT
          </span>
          <span className="rounded border border-cyan-900/50 px-2 py-1">
            GMT: {formatDuration(gmt.getUTCHours() * 3600000 + gmt.getUTCMinutes() * 60000 + gmt.getUTCSeconds() * 1000)}
          </span>
          <span className="rounded border border-cyan-900/50 px-2 py-1">
            MET: {formatDuration(metMs)}
          </span>
          <span className="rounded border border-cyan-900/50 px-2 py-1 text-amber-400/90">
            COMM: {mode === "space" ? "LOS · OWLT 20m 04s" : "LINK · PWA SYNC OK"}
          </span>
        </div>
        <div className="flex rounded border border-cyan-900/50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("space")}
            className={`rounded px-3 py-1 ${mode === "space" ? "bg-cyan-500/25 text-cyan-200" : "text-slate-500"}`}
          >
            Space Mode
          </button>
          <button
            type="button"
            onClick={() => setMode("earth")}
            className={`rounded px-3 py-1 ${mode === "earth" ? "bg-cyan-500/25 text-cyan-200" : "text-slate-500"}`}
          >
            Earth Mode – Rural PWA
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["EMERGENCY", "WARNING", "CAUTION", "ADVISORY"] as const).map((level) => {
          const active =
            (level === "EMERGENCY" && worst === "RED") ||
            (level === "WARNING" && worst === "RED") ||
            (level === "CAUTION" && worst === "YELLOW") ||
            (level === "ADVISORY" && worst === "GREEN");
          return (
            <span
              key={level}
              className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
                active
                  ? "border border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border border-slate-800 text-slate-600"
              }`}
            >
              {level}
            </span>
          );
        })}
        <span
          className={`ml-2 text-xs ${worst === "GREEN" ? "text-emerald-400" : worst === "YELLOW" ? "text-amber-400" : "text-red-400"}`}
        >
          ● {cwBanner}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] uppercase text-slate-600">Demo:</span>
        {DEMO_SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScenario(s.id as DemoScenarioId)}
            className="rounded border border-cyan-900/40 px-2 py-0.5 text-[10px] text-slate-400 hover:border-cyan-600/50 hover:text-cyan-300"
          >
            {s.label}
          </button>
        ))}
      </div>
    </header>
  );
}
