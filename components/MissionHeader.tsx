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

const STATUS: Record<RiskLevel, { text: string; cls: string; dot: string }> = {
  GREEN: { text: "All crew nominal", cls: "border-mc-green/40 text-mc-green", dot: "bg-mc-green" },
  YELLOW: { text: "Caution · check crew", cls: "border-mc-amber/50 text-mc-amber", dot: "bg-mc-amber" },
  RED: { text: "Warning · act now", cls: "border-mc-red/60 bg-mc-red/10 text-mc-red", dot: "bg-mc-red animate-pulse" },
};

export function MissionHeader({ crewRisks }: { crewRisks: RiskLevel[] }) {
  const { mode, setMode } = useMissionMode();
  const { scenario, setScenario } = useMissionTelemetry();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const status = STATUS[worstRisk(crewRisks.length ? crewRisks : ["GREEN"])];

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-mc-line bg-mc-header px-4 py-3 md:px-6">
      <div className="flex items-center gap-3">
        <svg width="32" height="32" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="16.5" fill="#0B3D91" stroke="#2A5BC0" />
          <ellipse cx="18" cy="18" rx="15" ry="6" fill="none" stroke="#FFFFFF" strokeOpacity=".55" transform="rotate(-24 18 18)" />
          <path d="M7 19h6l2-5 3 9 2.5-6H29" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <h1 className="text-[15px] font-bold tracking-[0.06em]">AAHMS</h1>
          <p className="text-[11px] text-mc-label">MTV-1 · Mars transit</p>
        </div>
      </div>

      <span className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${status.cls}`} role="status">
        <span className={`h-2 w-2 rounded-full ${status.dot}`} />
        {status.text}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-4">
        <div className="hidden text-right font-mono text-xs leading-tight sm:block">
          {/* Clock ticks every second, so server and client HTML differ by design. */}
          <div suppressHydrationWarning>MET {formatDayTime(now - MISSION_EPOCH)}</div>
          <div className={mode === "space" ? "text-mc-amber" : "text-mc-green"}>
            {mode === "space" ? "Earth link delay 20m 04s" : "Online · syncing"}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-mc-label">
          Demo
          <select
            value={scenario.id}
            onChange={(e) => setScenario(e.target.value as DemoScenarioId)}
            className="min-h-9 rounded-md border border-mc-line-strong bg-mc-panel px-2 text-xs text-foreground"
          >
            {DEMO_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Operating mode" className="flex rounded-lg border border-mc-line-strong bg-mc-panel p-[3px]">
          {(
            [
              ["space", "Space"],
              ["earth", "Earth"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={`min-h-8 rounded-md px-3 text-xs ${
                mode === id ? "bg-mc-nasa font-semibold text-white" : "font-medium text-mc-muted hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
            window.location.assign("/login");
          }}
          className="min-h-9 rounded-md border border-mc-line-strong px-3 text-xs font-medium text-mc-muted hover:text-white"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
