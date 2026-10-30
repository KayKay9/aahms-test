"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Card } from "./ui/Card";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { riskLabel, type RiskLevel } from "@/lib/risk";
import { assessBody, assessHazards, type HazardId, type RegionId } from "@/lib/bodyMap";
import { useMissionMode } from "./MissionModeContext";
import { markBodyMapSeen } from "@/lib/missions";
import { getLatestCheck, type StoredCheck } from "@/lib/selfCheck";
import { INJURY_TYPES, areaFor, injuryLevel, useInjuries } from "@/lib/injuries";
import { InjuryDetail, NewInjuryPanel } from "./InjuryPanel";
import { PeriodPanel } from "./PeriodPanel";

const MISSION_EPOCH = Date.UTC(2026, 0, 15);

const TONE: Record<RiskLevel, { text: string; fill: string; ring: string; bg: string }> = {
  GREEN: { text: "text-mc-green", fill: "#3ddc97", ring: "border-mc-green/50", bg: "bg-mc-green/10" },
  YELLOW: { text: "text-mc-amber", fill: "#f5b82e", ring: "border-mc-amber/60", bg: "bg-mc-amber/10" },
  RED: { text: "text-mc-red", fill: "#ff5d5d", ring: "border-mc-red/70", bg: "bg-mc-red/10" },
};

/** Hotspot positions as % of the figure box, plus the label side. */
const SPOTS: Record<RegionId, { x: number; y: number; side: "left" | "right" }> = {
  brain: { x: 50, y: 6.5, side: "right" },
  eyes: { x: 46, y: 10, side: "left" },
  lungs: { x: 41, y: 27, side: "left" },
  heart: { x: 56, y: 28.5, side: "right" },
  blood: { x: 76, y: 41, side: "right" },
  musculoskeletal: { x: 43, y: 70, side: "left" },
  reproductive: { x: 55, y: 53.5, side: "right" },
};

/** Left half of the body outline (mirrored for the right): neck, shoulder, arm, hand, torso, leg. */
const MALE_OUTLINE =
  "M100 58 L92 58 C92 64 91 68 89 72 C82 75 72 77 64 80 C56 83 52 89 51 97 C49 109 47 121 45 133 C44 145 42 155 40 165 C37 179 34 191 32 203 C31 207 29 211 29 217 C28 225 30 233 34 236 C38 238 41 233 41 227 C42 221 43 214 44 208 C47 196 50 184 53 172 C55 162 57 152 58 142 C59 132 61 125 63 119 C64 133 64 147 66 160 C67 170 66 180 66 190 C65 200 66 210 68 220 C70 250 72 280 76 300 C77 306 77 312 77 318 C76 340 77 362 80 378 C80 384 79 388 76 392 C74 396 78 398 86 398 C92 398 94 395 93 390 C93 380 94 360 95 340 C96 325 96 315 96 305 C97 280 98 250 98 232 L100 228 Z";
/** Narrower shoulders and waist, wider hips, chest curve. Same height and landmarks as the male figure. */
const FEMALE_OUTLINE =
  "M100 58 L93 58 C93 64 92 68 90 71 C84 74 76 76 68 79 C61 82 57 88 56 96 C54 108 52 120 50 132 C49 144 47 154 45 164 C42 178 39 190 37 202 C36 206 34 210 34 216 C33 224 35 232 39 235 C43 237 46 232 46 226 C47 220 48 213 49 207 C52 195 55 183 58 171 C60 161 62 151 63 141 C64 131 65 124 66 116 C66 122 68 128 69 134 C70 144 71 152 72 160 C72 170 67 181 63 193 C61 203 62 213 65 223 C68 251 71 280 75 300 C76 306 76 312 76 318 C75 340 76 362 79 378 C79 384 78 388 75 392 C73 396 77 398 85 398 C91 398 93 395 92 390 C92 380 93 360 94 340 C95 325 95 315 95 305 C96 280 97 250 98 232 L100 228 Z";

const FIGURE_KEY = "aahms_body_figure";
type Figure = "male" | "female";

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
  const { mode } = useMissionMode();
  useEffect(() => markBodyMapSeen(userId), [userId]);
  const client = useClientInputs(userId);
  // Body figure per crew member, chosen by the crew and remembered in this browser.
  const [figures, setFigures] = useState<Record<string, Figure>>({});
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from storage
      setFigures(JSON.parse(localStorage.getItem(FIGURE_KEY) ?? "{}"));
    } catch {
      /* unavailable */
    }
  }, []);
  const figure: Figure = figures[name] ?? "male";
  const chooseFigure = (f: Figure) => {
    const next = { ...figures, [name]: f };
    setFigures(next);
    try {
      localStorage.setItem(FIGURE_KEY, JSON.stringify(next));
    } catch {
      /* unavailable */
    }
  };

  const inputs = useMemo(
    () => ({
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
        sex: figure,
      }),
    [vitals, t, client, figure]
  );
  const regions = useMemo(() => assessBody(inputs), [inputs]);
  const hazards = useMemo(() => assessHazards(inputs, regions, mode === "space"), [inputs, regions, mode]);
  const [hazardId, setHazardId] = useState<HazardId | null>(null);
  const hazard = hazards.find((h) => h.id === hazardId) ?? null;
  const inHazard = (id: RegionId) => !hazard || hazard.regions.includes(id);

  const order: RiskLevel[] = ["RED", "YELLOW", "GREEN"];
  const worstId = [...regions].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level))[0].id;
  const [picked, setPicked] = useState<RegionId | null>(null);
  const active = regions.find((r) => r.id === (picked ?? worstId))!;
  const tone = TONE[active.level];
  const byId = Object.fromEntries(regions.map((r) => [r.id, r])) as Record<RegionId, (typeof regions)[number]>;
  const glow = (id: RegionId) => TONE[byId[id].level].fill;

  // External injuries: tap the figure in report mode to drop a marker at that spot.
  const { injuries, report, addUpdate, setHealed, remove } = useInjuries(name);
  const [reporting, setReporting] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number; area: string } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  // Placing stays on while a report is open, so tapping again moves the marker.
  const placing = reporting || draft !== null;

  const [injuryId, setInjuryId] = useState<string | null>(null);
  const openInjury = injuries.find((i) => i.id === injuryId) ?? null;
  const activeInjuries = injuries.filter((i) => !i.healed);

  return (
    <Card title={`Body map · ${name}`}>
      {/* NASA HRP's five hazards; picking one highlights the body systems it affects */}
      <div className="mb-5">
        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Five hazards of human spaceflight">
          {hazards.map((h) => {
            const on = hazardId === h.id;
            return (
              <button
                key={h.id}
                type="button"
                aria-pressed={on}
                onClick={() => setHazardId(on ? null : h.id)}
                className={`flex min-h-16 flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition ${
                  on ? `${TONE[h.level].ring} ${TONE[h.level].bg}` : "border-mc-line bg-mc-inset hover:border-mc-line-strong"
                }`}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="font-mono text-lg font-semibold leading-none">{h.letter}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: TONE[h.level].fill }} aria-hidden />
                </span>
                <span className="text-[11px] font-medium leading-tight text-mc-soft">{h.name}</span>
              </button>
            );
          })}
        </div>
        {hazard ? (
          <p className="mt-2 rounded-md border border-mc-line bg-mc-inset px-3 py-2 text-[13px] leading-relaxed text-mc-soft">
            <span className={`font-semibold ${TONE[hazard.level].text}`}>{hazard.name}: </span>
            <span className="font-mono text-xs text-mc-muted">{hazard.now}.</span> {hazard.about}{" "}
            <span className="text-mc-label">Highlighted: {hazard.regions.map((r) => byId[r].name).join(", ")}.</span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-mc-label">NASA&apos;s five hazards of spaceflight (RIDGE). Pick one to see which body systems it affects.</p>
        )}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-mc-line-strong text-xs" role="group" aria-label="Body figure">
          {(["male", "female"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={figure === f}
              onClick={() => chooseFigure(f)}
              className={`px-3 py-1.5 transition ${figure === f ? "bg-mc-select/25 text-white" : "text-mc-muted hover:bg-mc-raised"}`}
            >
              {f === "male" ? "♂ Male" : "♀ Female"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setReporting((r) => !r);
            setDraft(null);
          }}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            reporting ? "border-cyan-400 bg-cyan-500/20 text-cyan-100" : "border-mc-line-strong text-mc-soft hover:bg-mc-raised"
          }`}
        >
          {reporting ? "Tap the body where it hurts… (cancel)" : "🩹 Report injury"}
        </button>
        {activeInjuries.length > 0 && (
          <span className="text-xs text-mc-amber">
            {activeInjuries.length} active injur{activeInjuries.length === 1 ? "y" : "ies"}:{" "}
            {activeInjuries.map((i) => (
              <button key={i.id} type="button" onClick={() => setInjuryId(i.id)} className="mr-2 underline">
                {INJURY_TYPES[i.type].label.toLowerCase()} ({i.area.toLowerCase()})
              </button>
            ))}
          </span>
        )}
      </div>
      {/* While placing an injury the figure grows and shows the area under the pointer. */}
      <div className={`grid gap-6 ${placing ? "lg:grid-cols-[minmax(300px,420px)_1fr]" : "lg:grid-cols-[minmax(240px,320px)_1fr]"}`}>
        {/* Figure */}
        <div
          className={`relative mx-auto aspect-[1/2] w-full ${placing ? "max-w-[420px] cursor-none rounded-lg ring-1 ring-cyan-500/50" : "max-w-[300px]"}`}
          onPointerMove={(e) => {
            if (!placing) return;
            const box = e.currentTarget.getBoundingClientRect();
            setHover({ x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 });
          }}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            if (!placing) return;
            const box = e.currentTarget.getBoundingClientRect();
            const x = Math.round(((e.clientX - box.left) / box.width) * 1000) / 10;
            const y = Math.round(((e.clientY - box.top) / box.height) * 1000) / 10;
            setDraft({ x, y, area: areaFor(x, y, figure) });
            setReporting(false);
            setInjuryId(null);
          }}
        >
          {placing && hover && (
            <div className="pointer-events-none absolute inset-0 z-20">
              <span className="absolute h-px w-full bg-cyan-300/30" style={{ top: `${hover.y}%` }} />
              <span className="absolute h-full w-px bg-cyan-300/30" style={{ left: `${hover.x}%` }} />
              <span
                className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300 bg-cyan-300/20"
                style={{ left: `${hover.x}%`, top: `${hover.y}%` }}
              />
              <span
                className={`absolute -translate-y-1/2 whitespace-nowrap rounded bg-cyan-500 px-2 py-0.5 text-[11px] font-semibold text-slate-900 ${
                  hover.x > 60 ? "-translate-x-[calc(100%+14px)]" : "translate-x-[14px]"
                }`}
                style={{ left: `${hover.x}%`, top: `${hover.y}%` }}
              >
                {areaFor(hover.x, hover.y, figure)}
              </span>
            </div>
          )}
          <svg viewBox="0 0 200 400" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="bm-glow">
                <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="bm-body" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#14213b" />
                <stop offset="0.5" stopColor="#22345a" />
                <stop offset="1" stopColor="#14213b" />
              </linearGradient>
              <linearGradient id="bm-scan" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#7dd3fc" stopOpacity="0" />
                <stop offset="0.5" stopColor="#7dd3fc" stopOpacity="0.55" />
                <stop offset="1" stopColor="#7dd3fc" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Anatomical front view. Each half is drawn once and mirrored, so the figure stays symmetric. */}
            <g fill="url(#bm-body)" stroke="#3a5080" strokeWidth="1.2" strokeLinejoin="round">
              {(["", "matrix(-1 0 0 1 200 0)"] as const).map((m) => (
                <g key={m || "l"} transform={m || undefined}>
                  {/* longer hair behind the head on the female figure */}
                  {figure === "female" && (
                    <path d="M100 5 C86 5 75 14 75 30 C75 42 74 52 70 61 C77 64 84 61 88 56 L86 53 C83 50 81 44 81 36 C81 22 89 13 100 13 Z" fill="#101a2f" />
                  )}
                  {/* head and neck */}
                  <path d="M100 8 C88 8 79 16 79 30 C79 36 79 41 81 45 C80 46 79 49 81 51 C83 53 84 52 85 53 C88 57 93 60 100 60 Z" />
                  {/* neck, shoulder, arm, hand, torso and leg as one outline */}
                  <path d={figure === "female" ? FEMALE_OUTLINE : MALE_OUTLINE} />
                </g>
              ))}
            </g>

            {/* Surface anatomy: collarbones, chest, ribs, abdomen, knees */}
            <g fill="none" stroke="#5b76a8" strokeWidth="0.8" opacity="0.45" strokeLinecap="round">
              {(["", "matrix(-1 0 0 1 200 0)"] as const).map((m) => (
                <g key={m || "l"} transform={m || undefined}>
                  <path d="M72 81 Q86 85 98 83" />
                  <path d={figure === "female" ? "M72 102 Q74 120 88 120 Q96 119 98 112" : "M68 98 Q80 112 98 108"} />
                  <path d="M74 126 Q86 130 97 128" />
                  <path d="M76 138 Q87 141 97 140" />
                  <path d="M91 150 L91 196" opacity="0.6" />
                  <path d="M70 186 Q84 206 98 222" />
                  <ellipse cx="86" cy="310" rx="5" ry="6" />
                  <path d="M88 44 Q92 47 96 46" opacity="0.5" />
                </g>
              ))}
              <path d="M100 84 L100 196" opacity="0.5" />
              <path d="M95 160 L105 160 M95 172 L105 172 M95 184 L105 184" opacity="0.4" />
            </g>

            {/* Skeleton (musculoskeletal) */}
            <g stroke={glow("musculoskeletal")} fill="none" strokeLinecap="round" opacity="0.5">
              <path d="M100 66 L100 206" strokeWidth="2.5" strokeDasharray="3 2" />
              {(["", "matrix(-1 0 0 1 200 0)"] as const).map((m) => (
                <g key={m || "l"} transform={m || undefined} strokeWidth="3">
                  <path d="M58 98 L48 160" />
                  <path d="M46 168 L36 212" strokeWidth="2.2" />
                  <path d="M100 204 C92 200 82 202 76 208 C78 216 86 222 96 222" strokeWidth="2.2" />
                  <path d="M82 226 L85 300" strokeWidth="3.4" />
                  <path d="M86 318 L87 382" strokeWidth="2.6" />
                </g>
              ))}
            </g>

            {/* Circulation (blood): aortic arch, carotids, arm and leg arteries */}
            <g stroke={glow("blood")} fill="none" strokeWidth="1.6" opacity="0.7" strokeLinecap="round">
              <path d="M104 112 C104 98 96 95 96 104 L97 204" />
              <path d="M98 96 L95 64 M102 96 L105 64" strokeWidth="1.2" />
              {(["", "matrix(-1 0 0 1 200 0)"] as const).map((m) => (
                <g key={m || "l"} transform={m || undefined}>
                  <path d="M97 98 C82 92 64 96 56 118 L47 168 L37 214" />
                  <path d="M97 204 C91 212 86 222 85 240 L85 300 L86 380" />
                </g>
              ))}
            </g>

            {/* Organs tinted by status */}
            <g>
              <path
                d="M100 11 C90 11 83 17 83 26 C83 33 88 37 94 37 C96 36 98 37 100 37 C102 37 104 36 106 37 C112 37 117 33 117 26 C117 17 110 11 100 11 Z"
                fill={glow("brain")}
                opacity="0.4"
              />
              <path d="M100 12 L100 36 M88 20 Q93 23 90 28 M112 20 Q107 23 110 28 M92 32 Q96 30 98 33 M108 32 Q104 30 102 33" stroke="#0b1324" strokeWidth="0.8" fill="none" opacity="0.6" />
              <ellipse cx="92" cy="40" rx="4.2" ry="2.2" fill={glow("eyes")} opacity="0.85" />
              <ellipse cx="108" cy="40" rx="4.2" ry="2.2" fill={glow("eyes")} opacity="0.85" />
              <path d="M96 92 C88 90 78 96 75 108 C72 122 73 136 76 145 C83 147 91 143 97 138 Z" fill={glow("lungs")} opacity="0.35" />
              <path d="M104 92 C112 90 122 96 125 108 C128 122 127 136 124 145 C118 147 113 144 110 140 C108 132 106 124 104 118 Z" fill={glow("lungs")} opacity="0.35" />
              <path d="M98 84 L100 92 M100 92 L96 96 M100 92 L104 96" stroke={glow("lungs")} strokeWidth="1.4" opacity="0.6" fill="none" />
              <path d="M100 109 C104 103 113 103 116 110 C119 118 113 128 104 135 C99 129 96 121 98 115 Z" fill={glow("heart")} opacity="0.8" className="bm-heartbeat" />
            </g>

            {/* Reproductive & urinary system, drawn as a medical diagram for each figure */}
            <g fill={glow("reproductive")} stroke={glow("reproductive")} strokeWidth="0.8">
              {figure === "female" ? (
                <>
                  {/* breast tissue with nipples */}
                  <ellipse cx="85" cy="113" rx="10" ry="8" opacity="0.18" />
                  <ellipse cx="115" cy="113" rx="10" ry="8" opacity="0.18" />
                  <circle cx="85" cy="114" r="1.3" opacity="0.8" stroke="none" />
                  <circle cx="115" cy="114" r="1.3" opacity="0.8" stroke="none" />
                  {/* uterus, fallopian tubes and ovaries */}
                  <path d="M94 197 C94 191 106 191 106 197 C106 205 102 211 100 213 C98 211 94 205 94 197 Z" opacity="0.55" />
                  <path d="M95 195 Q88 192 85 197 M105 195 Q112 192 115 197" fill="none" opacity="0.7" />
                  <ellipse cx="84" cy="199" rx="3" ry="2" opacity="0.7" />
                  <ellipse cx="116" cy="199" rx="3" ry="2" opacity="0.7" />
                  {/* bladder and vulva */}
                  <ellipse cx="100" cy="218" rx="5" ry="3.5" opacity="0.3" />
                  <path d="M100 224 Q97.5 229 100 234 Q102.5 229 100 224 Z" fill="none" opacity="0.8" />
                </>
              ) : (
                <>
                  {/* bladder and prostate */}
                  <ellipse cx="100" cy="210" rx="6" ry="5" opacity="0.3" />
                  <circle cx="100" cy="217" r="2.5" opacity="0.55" />
                  {/* penis and testes */}
                  <path d="M97 225 L97 239 Q100 243 103 239 L103 225 Z" opacity="0.35" />
                  <ellipse cx="95.5" cy="236" rx="3" ry="4" opacity="0.45" />
                  <ellipse cx="104.5" cy="236" rx="3" ry="4" opacity="0.45" />
                </>
              )}
              {/* kidneys, shared by both */}
              <path d="M82 160 C78 160 77 170 80 175 C83 178 86 174 86 170 C86 166 85 160 82 160 Z" opacity="0.35" />
              <path d="M118 160 C122 160 123 170 120 175 C117 178 114 174 114 170 C114 166 115 160 118 160 Z" opacity="0.35" />
            </g>

            {/* Holographic scan line */}
            <rect x="20" y="0" width="160" height="3" fill="url(#bm-scan)" className="bm-scan" />
          </svg>

          {/* Injury markers */}
          {injuries.map((i) => {
            const lv = injuryLevel(i);
            return (
              <button
                key={i.id}
                type="button"
                aria-label={`${INJURY_TYPES[i.type].label}, ${i.area}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setInjuryId(i.id);
                  setDraft(null);
                }}
                className={`absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] shadow ${
                  injuryId === i.id ? "border-white" : "border-black/50"
                } ${i.healed ? "opacity-50" : ""} ${placing ? "pointer-events-none opacity-40" : ""}`}
                style={{ left: `${i.x}%`, top: `${i.y}%`, background: TONE[lv].fill }}
              >
                {!i.healed && lv !== "GREEN" && <span className="absolute inset-0 animate-ping rounded-full opacity-50" style={{ background: TONE[lv].fill }} />}
                <span className="relative">✚</span>
              </button>
            );
          })}
          {draft && (
            <>
              <span
                className="pointer-events-none absolute z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-dashed border-cyan-300 bg-cyan-300/20"
                style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
              />
              {!hover && (
                <span
                  className={`pointer-events-none absolute z-10 -translate-y-1/2 whitespace-nowrap rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-900 ${
                    draft.x > 60 ? "-translate-x-[calc(100%+16px)]" : "translate-x-[16px]"
                  }`}
                  style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
                >
                  {draft.area}
                </span>
              )}
            </>
          )}

          {/* Clickable hotspots (hidden while placing an injury so they don't cover the body) */}
          {!placing && regions.map((r) => {
            const s = SPOTS[r.id];
            const on = active.id === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPicked(r.id);
                  setInjuryId(null);
                  setDraft(null);
                }}
                aria-pressed={on}
                aria-label={`${r.name}: ${riskLabel(r.level)}`}
                className={`group absolute flex -translate-y-1/2 items-center gap-1.5 transition-opacity ${s.side === "left" ? "-translate-x-full flex-row-reverse" : ""} ${inHazard(r.id) ? "" : "opacity-25"}`}
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

        {/* Detail panel: a new injury report, an injury's details, or the picked body system */}
        {reporting && !draft ? (
          <section aria-live="polite" className="min-w-0">
            <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm leading-relaxed text-mc-soft">
              <h3 className="text-xl font-semibold text-foreground">Where does it hurt?</h3>
              <p className="mt-2">Move over the body: the label shows the exact area under the pointer. Tap to place the marker.</p>
              <p className="mt-2 text-xs text-mc-label">The figure faces you, so its right side is on your left. You can fine-tune the area from a list after tapping.</p>
            </div>
          </section>
        ) : draft ? (
          <section aria-live="polite" className="min-w-0">
            <NewInjuryPanel
              spot={draft}
              onAreaChange={(a) => setDraft({ x: a.x, y: a.y, area: a.name })}
              onCancel={() => setDraft(null)}
              onReport={(type, first) => {
                setInjuryId(report(type, draft.x, draft.y, first, draft.area));
                setDraft(null);
              }}
            />
          </section>
        ) : openInjury ? (
          <section aria-live="polite" className="min-w-0">
            <InjuryDetail
              injury={openInjury}
              onUpdate={(u) => addUpdate(openInjury.id, u)}
              onHealed={(h) => setHealed(openInjury.id, h)}
              onRemove={() => {
                remove(openInjury.id);
                setInjuryId(null);
              }}
              onClose={() => setInjuryId(null)}
            />
          </section>
        ) : (
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

          {active.id === "reproductive" && figure === "female" && <PeriodPanel name={name} />}

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
        )}
      </div>
    </Card>
  );
}
