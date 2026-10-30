"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "./ui/Card";
import { EcgMonitor } from "./EcgMonitor";
import { HrvTrend } from "./HrvTrend";
import { addVital, getRecentForUser } from "@/lib/db";
import { assessRisk, riskLabel, type RiskLevel } from "@/lib/risk";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { useSync } from "./SyncContext";

type VitalsMonitorProps = {
  userId: string;
  userName: string;
  canWrite: boolean;
  serverVitals?: {
    heartRate: number;
    hrv: number;
    spo2: number;
    radiation: number;
  };
  onLive?: (v: LiveVitals) => void;
};

export type LiveVitals = { userId: string; heartRate: number; hrv: number; risk: RiskLevel };

export function VitalsMonitor({
  userId,
  userName,
  canWrite,
  serverVitals,
  onLive,
}: VitalsMonitorProps) {
  const {
    scenario,
    simulationEnabled,
    radiation,
    arrhythmia,
  } = useMissionTelemetry();
  const { refreshCount } = useSync();
  const [display, setDisplay] = useState({
    heartRate: serverVitals?.heartRate ?? 78,
    hrv: serverVitals?.hrv ?? 62,
    spo2: serverVitals?.spo2 ?? 98,
    radiation: serverVitals?.radiation ?? 0.075,
  });
  const [hrvHistory, setHrvHistory] = useState<number[]>([]);
  const [manual, setManual] = useState({
    heartRate: 78,
    hrv: 62,
    spo2: 98,
    radiation: 0.075,
  });

  // Bedside monitors refresh numerics every second with small physiological drift.
  const [live, setLive] = useState(display);

  // Stored readings already include the scenario offset; adding it again would double count.
  const fromServer = serverVitals && {
    heartRate: serverVitals.heartRate,
    hrv: Math.max(10, serverVitals.hrv),
    spo2: serverVitals.spo2,
    radiation: radiation,
  };

  // Jump straight to a newly selected member's numbers instead of drifting over from the last one.
  // Done during render so the readout and crew card never show a frame of the previous member.
  const [shownUserId, setShownUserId] = useState(userId);
  if (shownUserId !== userId && fromServer) {
    setShownUserId(userId);
    setDisplay(fromServer);
    setLive(fromServer);
  }

  useEffect(() => {
    if (serverVitals) {
      setDisplay({
        heartRate: serverVitals.heartRate,
        hrv: Math.max(10, serverVitals.hrv),
        spo2: serverVitals.spo2,
        radiation: radiation,
      });
    }
  }, [serverVitals, radiation]);

  const writeVital = useCallback(
    async (v: typeof display) => {
      if (!canWrite) return;
      await addVital({
        id: crypto.randomUUID(),
        userId,
        heartRate: v.heartRate,
        hrv: v.hrv,
        spo2: v.spo2,
        radiation: v.radiation,
        timestamp: Date.now(),
      });
      await refreshCount();
    },
    [canWrite, userId, refreshCount]
  );

  useEffect(() => {
    if (!canWrite || !simulationEnabled) return;
    // Simulate around a fixed resting baseline. Seeding from the last stored reading made every
    // sync add the scenario offset again, so heart rate ratcheted up into the thousands.
    const base = { heartRate: 72, hrv: 62, spo2: 98 };
    const tick = () => {
      const v = {
        heartRate: Math.round(
          base.heartRate + scenario.heartRateOffset + (Math.random() * 6 - 3)
        ),
        hrv: Math.max(
          8,
          base.hrv + scenario.hrvOffset + (Math.random() * 4 - 2)
        ),
        spo2: base.spo2 + (Math.random() * 0.4 - 0.2),
        radiation,
      };
      setDisplay(v);
      void writeVital(v);
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [
    canWrite,
    simulationEnabled,
    scenario,
    radiation,
    writeVital,
  ]);

  useEffect(() => {
    void getRecentForUser(userId, 24).then((rows) => {
      setHrvHistory(rows.map((r) => r.hrv).reverse());
    });
  }, [userId, display.hrv]);

  useEffect(() => {
    const id = setInterval(() => {
      setLive((prev) => {
        const pull = (cur: number, target: number, jitter: number) =>
          cur + (target - cur) * 0.35 + (Math.random() - 0.5) * jitter;
        return {
          heartRate: Math.round(pull(prev.heartRate, display.heartRate, arrhythmia ? 14 : 2.4)),
          hrv: Math.max(8, pull(prev.hrv, display.hrv, 2.2)),
          spo2: Math.min(100, pull(prev.spo2, display.spo2, 0.5)),
          radiation: display.radiation,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [display, arrhythmia]);

  const risk = assessRisk(display);

  // Keep the selected crew card in step with this readout.
  useEffect(() => {
    if (shownUserId !== userId) return;
    onLive?.({ userId, heartRate: live.heartRate, hrv: live.hrv, risk });
  }, [onLive, userId, shownUserId, live.heartRate, live.hrv, risk]);

  const riskTone =
    risk === "GREEN"
      ? "border-[#1f5f48] text-mc-green"
      : risk === "YELLOW"
        ? "border-mc-amber/50 text-mc-amber"
        : "border-mc-red/50 text-mc-red";

  return (
    <Card
      title={
        <span className="text-sm font-semibold normal-case tracking-normal text-foreground">{userName}</span>
      }
      action={
        <span className={`rounded border px-2 py-1 font-mono text-[11px] ${riskTone}`}>
          {arrhythmia ? "Irregular rhythm" : "Normal rhythm"} · {riskLabel(risk)}
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Heart rate" value={live.heartRate} unit="bpm" big pulse />
        <Metric label="SpO₂" value={Math.round(live.spo2)} unit="%" big />
        <Metric label="HRV" value={Math.round(live.hrv)} unit="ms" big />
      </div>
      <div className="mt-4">
        <EcgMonitor heartRate={live.heartRate} hrv={live.hrv} irregular={arrhythmia} className="h-[130px]" />
      </div>

      <details className="group mt-4 border-t border-mc-line pt-3">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-xs font-medium text-mc-muted hover:text-white">
          24 h HRV trend{canWrite ? " and manual entry" : ""}
          <span className="transition group-open:rotate-180" aria-hidden>▾</span>
        </summary>
        <div className="mt-3">
          <HrvTrend userId={userId} values={hrvHistory} current={live.hrv} />
        </div>
      {canWrite && (
        <form
          className="mt-5 grid grid-cols-2 gap-3 border-t border-mc-line pt-4 text-xs md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = { ...manual, radiation };
            setDisplay(v);
            void writeVital(v);
          }}
        >
          {(
            [
              ["heartRate", "Heart rate"],
              ["hrv", "HRV"],
              ["spo2", "SpO₂"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="mc-label">
              {label}
              <input
                type="number"
                step={k === "spo2" ? 0.1 : 1}
                value={manual[k]}
                onChange={(e) =>
                  setManual((m) => ({ ...m, [k]: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-md border border-mc-line-strong bg-mc-inset px-2.5 py-2 font-mono text-sm normal-case tracking-normal text-foreground"
              />
            </label>
          ))}
          <button
            type="submit"
            className="col-span-2 min-h-11 rounded-md border border-mc-nasa-edge bg-mc-nasa text-sm font-semibold text-white md:col-span-1 md:self-end"
          >
            Record vitals
          </button>
        </form>
      )}
      </details>
    </Card>
  );
}

function Metric({
  label,
  value,
  unit,
  big = false,
  pulse = false,
}: {
  label: string;
  value: number;
  unit: string;
  big?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-mc-inset px-4 py-3">
      <span className="mc-label flex items-center gap-2">
        {label}
        {pulse && <span className="h-1.5 w-1.5 animate-ping rounded-full bg-mc-green" aria-hidden />}
      </span>
      <span className={`font-mono tabular-nums ${big ? "text-[32px] font-medium leading-tight" : "text-[22px]"}`}>
        {value}
        <span className="text-sm text-mc-label"> {unit}</span>
      </span>
    </div>
  );
}
