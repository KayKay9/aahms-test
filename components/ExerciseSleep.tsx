"use client";

import { Card } from "./ui/Card";
import { CircularProgress } from "./ui/CircularProgress";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";

export function ExerciseSleep() {
  const { exerciseMinutes, exerciseTarget, sleepHours, sleepTarget } =
    useMissionTelemetry();

  const exPct = (exerciseMinutes / exerciseTarget) * 100;
  const sleepPct = (sleepHours / sleepTarget) * 100;

  return (
    <Card title="Exercise & sleep adherence" className="flex flex-col">
      <div className="flex flex-wrap justify-around gap-4">
        <Ring
          pct={exPct}
          label={`${Math.round(exPct)}%`}
          sub={`${exerciseMinutes}/${exerciseTarget} MIN`}
          caption="Resistance + treadmill"
          stroke="stroke-mc-select"
        />
        <Ring
          pct={sleepPct}
          label={`${sleepHours}h`}
          sub={`OF ${sleepTarget.toFixed(1)} H`}
          caption="Sleep quota"
          stroke="stroke-mc-violet"
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded border border-[#1f4470] px-2 py-1 font-mono text-[11px] text-mc-link">
          ✓ ACCEL + HRV VERIFIED
        </span>
        <button
          type="button"
          className="min-h-9 rounded-md border border-mc-line-strong bg-[#0f182b] px-3.5 text-[13px] font-medium hover:bg-mc-raised"
        >
          Voice reminder
        </button>
      </div>
    </Card>
  );
}

function Ring({
  pct,
  label,
  sub,
  caption,
  stroke,
}: {
  pct: number;
  label: string;
  sub: string;
  caption: string;
  stroke: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <CircularProgress size={116} strokeWidth={9} percent={pct} trackClassName="stroke-mc-line" progressClassName={stroke}>
        <div className="font-mono text-[22px] leading-none">{label}</div>
        <div className="mt-1.5 font-mono text-[10px] text-mc-label">{sub}</div>
      </CircularProgress>
      <p className="text-[13px] text-mc-muted">{caption}</p>
    </div>
  );
}
