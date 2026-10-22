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
    <Card title="Exercise & sleep adherence">
      <div className="flex flex-wrap justify-around gap-6">
        <Ring
          pct={exPct}
          label={`${Math.round(exPct)}%`}
          sub={`${exerciseMinutes}/${exerciseTarget} min`}
          caption="Resistance + treadmill"
        />
        <Ring
          pct={sleepPct}
          label={`${sleepHours}h`}
          sub={`of ${sleepTarget} h`}
          caption="Sleep quota"
        />
      </div>
      <p className="mt-3 text-center text-[10px] text-emerald-500/80">
        ACCEL + HRV VERIFIED
      </p>
    </Card>
  );
}

function Ring({
  pct,
  label,
  sub,
  caption,
}: {
  pct: number;
  label: string;
  sub: string;
  caption: string;
}) {
  const size = 100;
  return (
    <div className="flex flex-col items-center gap-2">
      <CircularProgress size={size} strokeWidth={7} percent={pct}>
        <div className="font-mono text-sm leading-none text-cyan-100">{label}</div>
        <div className="mt-1 text-[10px] text-slate-500">{sub}</div>
      </CircularProgress>
      <p className="max-w-[120px] text-center text-[10px] text-slate-500">{caption}</p>
    </div>
  );
}
