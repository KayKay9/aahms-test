"use client";

import { useMemo, useState } from "react";
import { Card } from "./ui/Card";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { useCopilot } from "./CopilotProvider";
import { riskLabel, type RiskLevel } from "@/lib/risk";
import {
  MOODS,
  STEPS,
  assessAll,
  overallLevel,
  saveLatestCheck,
  stepLevel,
  type Mood,
  type SelfCheckValues,
  type StepId,
} from "@/lib/selfCheck";

const TONE: Record<RiskLevel, { text: string; border: string; bg: string; dot: string }> = {
  GREEN: { text: "text-mc-green", border: "border-mc-green/40", bg: "bg-mc-green/10", dot: "bg-mc-green" },
  YELLOW: { text: "text-mc-amber", border: "border-mc-amber/50", bg: "bg-mc-amber/10", dot: "bg-mc-amber" },
  RED: { text: "text-mc-red", border: "border-mc-red/60", bg: "bg-mc-red/10", dot: "bg-mc-red" },
};

const inputCls =
  "w-full rounded-md border border-mc-line-strong bg-mc-inset px-3 py-2.5 font-mono text-xl text-foreground focus:border-mc-select focus:outline-none";

/** Parse a typed reading; values outside what a device can show count as typos. */
function num(s: string, lo: number, hi: number): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

const LIMITS = { sys: [50, 260], dia: [30, 160], glucose: [20, 600], temp: [30, 45], sleep: [0, 24] } as const;

/**
 * Guided morning check: one indicator per step with how-to instructions, why it matters
 * in space, the normal range, and an instant colour as the value is entered. Ends with a
 * summary, advice per item, and a route to the CMO / ground surgeon when anything is red.
 */
export function DailySelfCheck({ userId, userName, onDone }: { userId: string; userName: string; onDone?: () => void }) {
  const { sleepHours } = useMissionTelemetry();
  const { setChatOpen, setInput } = useCopilot();
  const [step, setStep] = useState(-1); // -1 intro, 0..n-1 steps, n summary
  const [raw, setRaw] = useState({ sys: "", dia: "", glucose: "", temp: "" });
  const [fasting, setFasting] = useState(true);
  const [mood, setMood] = useState<Mood | null>(null);
  const [moodNote, setMoodNote] = useState("");
  const [sleep, setSleep] = useState(sleepHours.toFixed(1));
  const [escalated, setEscalated] = useState(false);

  const values: SelfCheckValues = useMemo(
    () => ({
      systolic: num(raw.sys, ...LIMITS.sys),
      diastolic: num(raw.dia, ...LIMITS.dia),
      glucose: num(raw.glucose, ...LIMITS.glucose),
      temperature: num(raw.temp, ...LIMITS.temp),
      mood,
      moodNote,
      sleepHours: num(sleep, ...LIMITS.sleep),
      fasting,
    }),
    [raw, mood, moodNote, sleep, fasting]
  );
  const results = useMemo(() => assessAll(values), [values]);
  const overall = overallLevel(results);
  const n = STEPS.length;

  const finish = () => {
    saveLatestCheck({ userId, at: Date.now(), items: results });
    setStep(n);
  };

  const askCopilot = () => {
    const flagged = results.filter((r) => r.level !== "GREEN");
    setInput(
      flagged.length
        ? `My self-check today: ${flagged.map((r) => `${r.label} ${r.display}`).join(", ")}. What should I do?`
        : "My self-check today is all normal. Anything I should keep an eye on?"
    );
    setChatOpen(true);
  };

  if (step === -1) {
    return (
      <Card title="Daily self-check">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-semibold">Good morning, {userName}.</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-mc-muted">
              Five quick measurements, about 2 minutes. Each step shows how to measure and why it matters up here.
              Results are coloured as you type: green is fine, amber means watch it, red means act now.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STEPS.map((s) => (
                <span key={s.id} className="rounded-full border border-mc-line-strong px-3 py-1 text-xs text-mc-soft">
                  {s.title}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(0)}
            className="min-h-12 shrink-0 rounded-md border border-mc-nasa-edge bg-mc-nasa px-6 text-sm font-semibold text-white"
          >
            Start check
          </button>
        </div>
      </Card>
    );
  }

  if (step === n) {
    const tone = TONE[overall];
    return (
      <Card title="Daily self-check · results">
        <div className={`rounded-lg border p-4 ${tone.border} ${tone.bg}`}>
          <p className="mc-label">Overall</p>
          <p className={`text-2xl font-semibold ${tone.text}`}>{riskLabel(overall)}</p>
          <p className="mt-1 text-sm text-mc-soft">
            {overall === "GREEN"
              ? "Everything is in range. Nice work, see you tomorrow."
              : overall === "YELLOW"
                ? "A few things to watch. Follow the tips below and recheck tomorrow."
                : "Something needs attention now. Follow the steps below and contact the CMO."}
          </p>
        </div>
        <ul className="mt-4 divide-y divide-mc-line">
          {results.map((r) => (
            <li key={r.id} className="flex gap-3 py-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE[r.level].dot}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{r.label}</span>
                  <span className={`font-mono text-sm ${TONE[r.level].text}`}>
                    {r.display} · {riskLabel(r.level)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-mc-muted">{r.advice}</p>
              </div>
            </li>
          ))}
          {results.length === 0 && <li className="py-3 text-sm text-mc-label">No measurements entered.</li>}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {overall === "RED" && (
            <button
              type="button"
              onClick={() => setEscalated(true)}
              disabled={escalated}
              className="min-h-11 rounded-md border border-mc-red bg-mc-red/15 px-4 text-sm font-semibold text-mc-red disabled:opacity-70"
            >
              {escalated ? "✓ CMO alerted · report queued for ground" : "Alert CMO + send to ground surgeon"}
            </button>
          )}
          <button
            type="button"
            onClick={askCopilot}
            className="min-h-11 rounded-md border border-mc-nasa-edge bg-mc-nasa px-4 text-sm font-semibold text-white"
          >
            Ask the co-pilot about my results
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(-1);
              onDone?.();
            }}
            className="min-h-11 rounded-md border border-mc-line-strong px-4 text-sm text-mc-soft"
          >
            Done
          </button>
        </div>
        {escalated && (
          <p className="mt-2 text-xs text-mc-label">
            Earth is 20 minutes away one way. The report will reach the ground surgeon on the next sync; the CMO on board has been notified now.
          </p>
        )}
      </Card>
    );
  }

  const info = STEPS[step];
  const level = info.id === "mood" ? (mood ? stepLevel("mood", values) : null) : stepLevel(info.id as StepId, values);
  const result = results.find((r) => r.id === info.id);
  const typo =
    (info.id === "bp" && ((raw.sys && values.systolic == null) || (raw.dia && values.diastolic == null))) ||
    (info.id === "glucose" && raw.glucose && values.glucose == null) ||
    (info.id === "temperature" && raw.temp && values.temperature == null) ||
    (info.id === "sleep" && sleep && values.sleepHours == null);

  return (
    <Card
      title={`Daily self-check · step ${step + 1} of ${n}`}
      action={
        <div className="flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.id} className={`h-1.5 w-8 rounded-full ${i < step ? "bg-mc-select" : i === step ? "bg-white" : "bg-mc-line"}`} />
          ))}
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* How and why */}
        <div>
          <h3 className="text-2xl font-semibold">{info.title}</h3>
          <p className="mt-1 font-mono text-xs text-mc-label">
            Normal: {info.normal} · Hazard: {info.hazard}
          </p>
          <p className="mc-label mt-4">How to measure</p>
          <ol className="mt-2 space-y-2">
            {info.howTo.map((t, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-mc-soft">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mc-raised font-mono text-xs">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
          <details className="mt-4 rounded-md border border-mc-line bg-mc-inset px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-mc-link">Why this matters in space</summary>
            <p className="mt-2 text-[13px] leading-relaxed text-mc-muted">{info.whySpace}</p>
          </details>
        </div>

        {/* Input and instant result */}
        <div className="flex flex-col gap-3">
          {info.id === "bp" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="mc-label">
                Systolic (top)
                <input inputMode="numeric" value={raw.sys} onChange={(e) => setRaw({ ...raw, sys: e.target.value })} placeholder="118" className={`${inputCls} mt-1.5`} autoFocus />
              </label>
              <label className="mc-label">
                Diastolic (bottom)
                <input inputMode="numeric" value={raw.dia} onChange={(e) => setRaw({ ...raw, dia: e.target.value })} placeholder="76" className={`${inputCls} mt-1.5`} />
              </label>
            </div>
          )}
          {info.id === "glucose" && (
            <>
              <label className="mc-label">
                Blood sugar (mg/dL)
                <input inputMode="numeric" value={raw.glucose} onChange={(e) => setRaw({ ...raw, glucose: e.target.value })} placeholder="92" className={`${inputCls} mt-1.5`} autoFocus />
              </label>
              <label className="flex items-center gap-2 text-sm text-mc-soft">
                <input type="checkbox" checked={fasting} onChange={(e) => setFasting(e.target.checked)} className="h-4 w-4 accent-mc-select" />
                Fasting (nothing eaten for 8 hours)
              </label>
            </>
          )}
          {info.id === "temperature" && (
            <label className="mc-label">
              Temperature (°C)
              <input inputMode="decimal" value={raw.temp} onChange={(e) => setRaw({ ...raw, temp: e.target.value })} placeholder="36.8" className={`${inputCls} mt-1.5`} autoFocus />
            </label>
          )}
          {info.id === "mood" && (
            <>
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Mood">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={mood === m.value}
                    onClick={() => setMood(m.value)}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border text-xs transition ${
                      mood === m.value ? "border-mc-select bg-mc-select/15 text-white" : "border-mc-line-strong text-mc-muted hover:text-white"
                    }`}
                  >
                    <span className="text-3xl" aria-hidden>
                      {m.face}
                    </span>
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="mc-label">
                Anything on your mind? (optional, private)
                <input value={moodNote} onChange={(e) => setMoodNote(e.target.value)} className="mt-1.5 w-full rounded-md border border-mc-line-strong bg-mc-inset px-3 py-2 text-sm normal-case tracking-normal text-foreground" />
              </label>
            </>
          )}
          {info.id === "sleep" && (
            <label className="mc-label">
              Hours slept last night
              <input inputMode="decimal" value={sleep} onChange={(e) => setSleep(e.target.value)} className={`${inputCls} mt-1.5`} autoFocus />
              <span className="mt-1 block normal-case tracking-normal text-mc-label">Pre-filled from your sleep log.</span>
            </label>
          )}

          <div
            className={`min-h-24 rounded-lg border p-3 transition ${level ? `${TONE[level].border} ${TONE[level].bg}` : "border-mc-line bg-mc-inset"}`}
            aria-live="polite"
          >
            {typo ? (
              <p className="text-[13px] text-mc-amber">That number looks off. Check the reading and re-enter it.</p>
            ) : level && result ? (
              <>
                <p className={`font-mono text-sm font-semibold ${TONE[level].text}`}>
                  {result.display} · {riskLabel(level)}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-mc-soft">{result.advice}</p>
              </>
            ) : (
              <p className="text-[13px] text-mc-label">Your result and what to do will appear here.</p>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <button type="button" onClick={() => setStep(step - 1)} className="min-h-11 rounded-md px-3 text-sm text-mc-muted hover:text-white">
              ← Back
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (step === n - 1 ? finish() : setStep(step + 1))}
                className="min-h-11 rounded-md px-3 text-sm text-mc-label hover:text-white"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => (step === n - 1 ? finish() : setStep(step + 1))}
                className="min-h-11 rounded-md border border-mc-nasa-edge bg-mc-nasa px-5 text-sm font-semibold text-white"
              >
                {step === n - 1 ? "See results" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
