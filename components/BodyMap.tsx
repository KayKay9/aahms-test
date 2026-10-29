"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Card } from "./ui/Card";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { riskLabel, type RiskLevel } from "@/lib/risk";
import { assessBody, type RegionId } from "@/lib/bodyMap";
import { getLatestCheck, type StoredCheck } from "@/lib/selfCheck";

const MISSION_EPOCH = Date.UTC(2026, 0, 15);

const TONE: Record<RiskLevel, { text: string; fill: string; ring: string; bg: string }> = {
  GREEN: { text: "text-mc-green", fill: "#3ddc97", ring: "border-mc-green/50", bg: "bg-mc-green/10" },
  YELLOW: { text: "text-mc-amber", fill: "#f5b82e", ring: "border-mc-amber/60", bg: "bg-mc-amber/10" },
  RED: { text: "text-mc-red", fill: "#ff5d5d", ring: "border-mc-red/70", bg: "bg-mc-red/10" },
};

/** Hotspot positions as % of the figure box, plus the label side. */
const SPOTS: Record<RegionId, { x: number; y: number; side: "left" | "right" }> = {
  brain: { x: 50, y: 6.5, side: "right" },
  eyes: { x: 50, y: 11.5, side: "left" },
  lungs: { x: 41, y: 27, side: "left" },
  heart: { x: 56, y: 28.5, side: "right" },
  blood: { x: 76, y: 41, side: "right" },
  musculoskeletal: { x: 43, y: 70, side: "left" },
};

const noopSubscribe = () => () => {};

/** Browser-only inputs (self-check, PVT, mission day) read after hydration. */
function useClientInputs(userId: string) {
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => {
      let pvt: { mean: number; lapses: number } | null = null;
      try {
        const s = localStorage.getItem("aahms_pvt_summary");
        if (s) pvt = JSON.parse(s);
      } catch {
        /* unavailable */
      }
      const day = Math.floor((Date.now() - MISSION_EPOCH) / 86_400_000) + 1;
      return JSON.stringify({ check: getLatestCheck(userId), pvt, day });
    },
    () => JSON.stringify({ check: null, pvt: null, day: 1 })
  );
  return useMemo(
    () => JSON.parse(raw) as { check: StoredCheck | null; pvt: { mean: number; lapses: number } | null; day: number },
    [raw]
  );
}

export function BodyMap({
  userId,
  name,
  vitals,
  onOpenSelfCheck,
}: {
  userId: string;
  name: string;
  vitals: { heartRate: number; hrv: number; spo2: number; radiation: number };
  onOpenSelfCheck: () => void;
}) {
  const t = useMissionTelemetry();
  const client = useClientInputs(userId);
  const regions = useMemo(
    () =>
      assessBody({
        heartRate: vitals.heartRate,
        hrv: vitals.hrv,
        spo2: vitals.spo2,
        doseRate: t.radiation,
        arrhythmia: t.arrhythmia,
        ppCO2: t.ppCO2,
        sleepHours: t.sleepHours,
        sleepTarget: t.sleepTarget,
        exerciseMinutes: t.exerciseMinutes,
        exerciseTarget: t.exerciseTarget,
        voiceStress: t.voiceStress,
        pvt: client.pvt,
        check: client.check,
        missionDay: client.day,
      }),
    [vitals, t, client]
  );

  const order: RiskLevel[] = ["RED", "YELLOW", "GREEN"];
  const worstId = [...regions].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))[0].id;
  const [picked, setPicked] = useState<RegionId | null>(null);
  const active = regions.find((r) => r.id === (picked ?? worstId))!;
  const tone = TONE[active.level];
  const byId = Object.fromEntries(regions.map((r) => [r.id, r])) as Record<RegionId, (typeof regions)[number]>;
  const glow = (id: RegionId) => TONE[byId[id].level].fill;

  return (
    <Card title={`Body map · ${name}`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_1fr]">
        {/* Figure */}
        <div className="relative mx-auto aspect-[1/2] w-full max-w-[300px]">
          <svg viewBox="0 0 200 400" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="bm-glow">
                <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="bm-body" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#1d2b4a" />
                <stop offset="1" stopColor="#0f182b" />
              </linearGradient>
            </defs>
            {/* Silhouette */}
            <g fill="url(#bm-body)" stroke="#2a3a5e" strokeWidth="1.5">
              <circle cx="100" cy="36" r="26" />
              <rect x="90" y="60" width="20" height="14" rx="4" />
              <path d="M62 78 Q100 66 138 78 L146 150 Q140 196 128 206 L72 206 Q60 196 54 150 Z" />
              <path d="M62 80 Q44 90 40 120 L32 190 Q30 200 38 202 Q46 202 46 192 L56 128" />
              <path d="M138 80 Q156 90 160 120 L168 190 Q170 200 162 202 Q154 202 154 192 L144 128" />
              <path d="M74 204 L68 300 L72 382 Q74 392 86 392 Q92 390 90 380 L92 300 L98 214 Z" />
              <path d="M126 204 L132 300 L128 382 Q126 392 114 392 Q108 390 110 380 L108 300 L102 214 Z" />
            </g>
            {/* Organ overlays tinted by status */}
            <ellipse cx="100" cy="28" rx="20" ry="14" fill={glow("brain")} opacity="0.35" />
            <ellipse cx="91" cy="40" rx="5" ry="3" fill={glow("eyes")} opacity="0.8" />
            <ellipse cx="109" cy="40" rx="5" ry="3" fill={glow("eyes")} opacity="0.8" />
            <ellipse cx="84" cy="112" rx="15" ry="26" fill={glow("lungs")} opacity="0.3" />
            <ellipse cx="116" cy="112" rx="15" ry="26" fill={glow("lungs")} opacity="0.3" />
            <path d="M110 108 q8 -10 14 0 q4 8 -8 20 q-6 6 -6 6 q0 0 -6 -6 q-10 -12 -2 -20 q6 -6 8 0z" fill={glow("heart")} opacity="0.75" />
            <g stroke={glow("blood")} strokeWidth="2" opacity="0.6" fill="none">
              <path d="M100 96 L100 196" />
              <path d="M100 150 Q130 150 150 160" />
              <path d="M100 150 Q70 150 50 160" />
              <path d="M96 200 L82 300 L80 380" />
              <path d="M104 200 L118 300 L120 380" />
            </g>
            <g stroke={glow("musculoskeletal")} strokeWidth="5" strokeLinecap="round" opacity="0.45">
              <path d="M84 216 L80 296" />
              <path d="M116 216 L120 296" />
              <path d="M80 304 L80 376" />
              <path d="M120 304 L120 376" />
            </g>
          </svg>

          {/* Clickable hotspots */}
          {regions.map((r) => {
            const s = SPOTS[r.id];
            const on = active.id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setPicked(r.id)}
                aria-pressed={on}
                aria-label={`${r.name}: ${riskLabel(r.level)}`}
                className={`group absolute flex -translate-y-1/2 items-center gap-1.5 ${s.side === "left" ? "-translate-x-full flex-row-reverse" : ""}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
              >
                <span className="relative flex h-4 w-4 items-center justify-center">
                  {r.level !== "GREEN" && (
                    <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: TONE[r.level].fill }} />
                  )}
                  <span
                    className={`relative h-3 w-3 rounded-full ring-2 ${on ? "ring-white" : "ring-black/40"}`}
                    style={{ background: TONE[r.level].fill }}
                  />
                </span>
                <span
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium transition ${
                    on ? "bg-white text-slate-900" : "bg-black/50 text-mc-soft group-hover:bg-black/70 group-hover:text-white"
                  }`}
                >
                  {r.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <section aria-live="polite" className="flex min-w-0 flex-col gap-4">
          <div className={`rounded-lg border p-4 ${tone.ring} ${tone.bg}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xl font-semibold">{active.name}</h3>
              <span className={`font-mono text-sm font-semibold ${tone.text}`}>● {riskLabel(active.level)}</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-mc-label">Hazards: {active.hazards}</p>
          </div>

          <div>
            <p className="mc-label">Readings</p>
            <ul className="mt-2 divide-y divide-mc-line rounded-md border border-mc-line">
              {active.readings.map((rd) => (
                <li key={rd.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-mc-muted">{rd.label}</span>
                  <span className={`font-mono ${rd.level ? TONE[rd.level].text : "text-mc-label"}`}>{rd.value}</span>
                </li>
              ))}
            </ul>
            {active.readings.some((rd) => rd.value === "not done today") && (
              <button type="button" onClick={onOpenSelfCheck} className="mt-2 text-xs text-mc-link underline">
                Do today&apos;s self-check to fill these in
              </button>
            )}
          </div>

          <div className="grid gap-3">
            <div className="rounded-md border border-mc-line bg-mc-inset p-3">
              <p className="mc-label">What it does</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mc-soft">{active.role}</p>
            </div>
            <div className="rounded-md border border-mc-line bg-mc-inset p-3">
              <p className="mc-label">How space affects it</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mc-soft">{active.space}</p>
            </div>
          </div>

          <div>
            <p className="mc-label">What to do now</p>
            <ul className="mt-2 space-y-2">
              {active.actions.map((a) => (
                <li key={a} className="flex gap-2 text-sm leading-relaxed text-mc-soft">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full`} style={{ background: TONE[active.level].fill }} />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </Card>
  );
}
