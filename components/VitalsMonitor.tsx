"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./ui/Card";
import { addVital, getRecentForUser } from "@/lib/db";
import { assessRisk, riskLabel } from "@/lib/risk";
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
};

export function VitalsMonitor({
  userId,
  userName,
  canWrite,
  serverVitals,
}: VitalsMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    radiation: serverVitals?.radiation ?? 0.021,
  });
  const [hrvHistory, setHrvHistory] = useState<number[]>([]);
  const [manual, setManual] = useState({
    heartRate: 78,
    hrv: 62,
    spo2: 98,
    radiation: 0.021,
  });

  useEffect(() => {
    if (serverVitals) {
      setDisplay({
        heartRate: serverVitals.heartRate + scenario.heartRateOffset,
        hrv: Math.max(10, serverVitals.hrv + scenario.hrvOffset),
        spo2: serverVitals.spo2,
        radiation: radiation,
      });
    }
  }, [serverVitals, scenario, radiation]);

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
    const base = serverVitals ?? {
      heartRate: 78,
      hrv: 62,
      spo2: 98,
      radiation: 0.021,
    };
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
    serverVitals,
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const w = canvas.width;
    const h = canvas.height;

    const draw = () => {
      ctx.fillStyle = "#070b14";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const bpm = display.heartRate;
      const period = (60 / bpm) * 60;
      for (let x = 0; x < w; x++) {
        const t = (x + frame) / period;
        let y = h / 2;
        if (arrhythmia) {
          y += Math.sin(t * Math.PI * 2) * 12 + Math.sin(t * 17) * 8;
        } else {
          const beat = t % 1;
          if (beat < 0.1) y -= 25 * (beat / 0.1);
          else if (beat < 0.15) y += 35 * ((beat - 0.1) / 0.05);
          else if (beat < 0.2) y -= 15 * ((beat - 0.15) / 0.05);
          else y += Math.sin(t * Math.PI * 2) * 3;
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      frame += 2;
      requestAnimationFrame(draw);
    };
    draw();
  }, [display.heartRate, arrhythmia]);

  const risk = assessRisk(display);
  const rhythm = arrhythmia ? "IRREGULAR RHYTHM — REVIEW" : "NORMAL SINUS RHYTHM";

  return (
    <Card title={`Biometrics — ${userName}`}>
      <canvas
        ref={canvasRef}
        width={640}
        height={120}
        className="mb-4 w-full rounded border border-cyan-900/30 bg-[#070b14]"
      />
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <Metric label="Heart rate" value={`${display.heartRate} bpm`} />
        <Metric label="SpO₂" value={`${display.spo2.toFixed(0)}%`} />
        <Metric label="HRV" value={`${Math.round(display.hrv)} ms`} />
        <span
          className={`rounded border px-2 py-0.5 text-[10px] ${
            risk === "GREEN"
              ? "border-emerald-500/40 text-emerald-400"
              : risk === "YELLOW"
                ? "border-amber-500/40 text-amber-400"
                : "border-red-500/40 text-red-400"
          }`}
        >
          {rhythm} · {riskLabel(risk)}
        </span>
      </div>
      <div className="mb-4">
        <p className="mb-1 text-[10px] uppercase text-slate-600">24h HRV RMSSD</p>
        <div className="flex h-8 items-end gap-0.5">
          {(hrvHistory.length ? hrvHistory : [40, 45, 50, 55, 60, 62, 58, 65]).map(
            (v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-cyan-600/60"
                style={{ height: `${Math.min(100, v)}%` }}
              />
            )
          )}
        </div>
      </div>
      {canWrite && (
        <form
          className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 text-xs md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            const v = { ...manual, radiation };
            setDisplay(v);
            void writeVital(v);
          }}
        >
          {(["heartRate", "hrv", "spo2"] as const).map((k) => (
            <label key={k} className="text-slate-500">
              {k}
              <input
                type="number"
                step={k === "spo2" ? 0.1 : 1}
                value={manual[k]}
                onChange={(e) =>
                  setManual((m) => ({ ...m, [k]: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-slate-200"
              />
            </label>
          ))}
          <button
            type="submit"
            className="col-span-2 rounded bg-cyan-700/80 py-2 text-white md:col-span-1 md:self-end"
          >
            Record vitals
          </button>
        </form>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="font-mono text-lg text-cyan-100">{value}</p>
    </div>
  );
}
