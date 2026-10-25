"use client";

import type { RiskLevel } from "@/lib/risk";

export type CrewMemberView = {
  id: string;
  name: string;
  callsign: string;
  heartRate: number;
  hrv: number;
  risk: RiskLevel;
};

const RISK_DOT: Record<RiskLevel, string> = {
  GREEN: "bg-mc-green",
  YELLOW: "bg-mc-amber",
  RED: "bg-mc-red",
};

export function CrewOverview({
  members,
  selectedId,
  onSelect,
}: {
  members: CrewMemberView[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {members.map((m) => {
        const selected = selectedId === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            aria-pressed={selected}
            className={`flex flex-col gap-2 rounded-lg border px-4 py-3.5 text-left transition ${
              selected
                ? "border-mc-select bg-[#0f1a30]"
                : "border-mc-line bg-mc-panel hover:border-mc-line-strong"
            }`}
          >
            <span className="flex items-center justify-between">
              <span className="text-sm font-semibold">{m.name}</span>
              <span className="font-mono text-[11px] text-mc-label">{m.callsign}</span>
            </span>
            <span className="flex items-baseline gap-3.5">
              <span className="font-mono text-xl">
                {m.heartRate}
                <span className="text-[11px] text-mc-label"> BPM</span>
              </span>
              <span className="font-mono text-xs text-mc-muted">HRV {Math.round(m.hrv)}</span>
              <span
                className={`ml-auto h-2 w-2 self-center rounded-full ${RISK_DOT[m.risk]}`}
                aria-label={`Risk ${m.risk.toLowerCase()}`}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
