"use client";

import { riskColorClass, type RiskLevel } from "@/lib/risk";

export type CrewMemberView = {
  id: string;
  name: string;
  callsign: string;
  heartRate: number;
  hrv: number;
  risk: RiskLevel;
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
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {members.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m.id)}
          className={`rounded-lg border p-3 text-left transition ${
            selectedId === m.id
              ? "border-cyan-500/60 bg-cyan-500/10"
              : "border-cyan-900/40 bg-[#0a1020] hover:border-cyan-800/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-200">{m.name}</span>
            <span
              className={`rounded px-1.5 text-[10px] border ${riskColorClass(m.risk)}`}
            >
              {m.callsign}
            </span>
          </div>
          <div className="mt-2 flex gap-4 font-mono text-sm">
            <span>
              <span className="text-slate-500 text-xs">BPM </span>
              {m.heartRate}
            </span>
            <span>
              <span className="text-slate-500 text-xs">HRV </span>
              {Math.round(m.hrv)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
