"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./ui/Card";
import { CircularProgress } from "./ui/CircularProgress";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import {
  EXERCISE_PLAN,
  formatHours,
  sleepDuration,
  type ExerciseType,
} from "@/lib/routineLog";

const nowHHMM = () => new Date().toTimeString().slice(0, 5);

/** "6 hours 36 minutes", read naturally by speech synthesis. */
function spokenHours(h: number) {
  const total = Math.round(h * 60);
  const whole = Math.floor(total / 60);
  const mins = total % 60;
  return [whole ? `${whole} hour${whole === 1 ? "" : "s"}` : "", mins ? `${mins} minutes` : ""].filter(Boolean).join(" ");
}

/** Bedtime that gives the full sleep target before the usual wake time. */
function suggestedBedtime(wake: string, targetHours: number) {
  const [h, m] = wake.split(":").map(Number);
  let mins = h * 60 + m - Math.round(targetHours * 60);
  if (mins < 0) mins += 24 * 60;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export function ExerciseSleep() {
  const { routine, exerciseMinutes, exerciseTarget, sleepHours, sleepTarget } = useMissionTelemetry();
  const exPct = (exerciseMinutes / exerciseTarget) * 100;
  const sleepPct = (sleepHours / sleepTarget) * 100;
  const bedtime = suggestedBedtime(routine.sleep.wake, sleepTarget);

  const reminderText = useCallback(() => {
    const left = Math.max(0, exerciseTarget - exerciseMinutes);
    const behind = routine.byType.filter((t) => t.done < t.target);
    const exercisePart =
      left === 0
        ? "Exercise is complete for today, well done."
        : `You have ${left} minutes of exercise left today: ${behind
            .map((t) => `${t.target - t.done} minutes on the ${t.spoken}`)
            .join(", ")}.`;
    const debt = sleepTarget - sleepHours;
    const sleepPart =
      debt > 0.25
        ? `You slept ${spokenHours(sleepHours)} last night, ${spokenHours(debt)} short of target. Aim for lights out by ${bedtime}.`
        : "Sleep is on target.";
    return `${exercisePart} ${sleepPart}`;
  }, [exerciseMinutes, exerciseTarget, routine.byType, sleepHours, sleepTarget, bedtime]);

  const [lastReminder, setLastReminder] = useState<string | null>(null);
  const speak = useCallback(() => {
    const text = reminderText();
    setLastReminder(text);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  }, [reminderText]);

  // Repeating reminders while there is still exercise left, like the station's timeline alerts.
  const [autoEvery, setAutoEvery] = useState(0);
  const [nextAt, setNextAt] = useState<string | null>(null);
  const speakRef = useRef(speak);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);
  const done = exerciseMinutes >= exerciseTarget;
  useEffect(() => {
    if (!autoEvery || done) return;
    const ms = autoEvery * 60_000;
    const schedule = () => setNextAt(new Date(Date.now() + ms).toTimeString().slice(0, 5));
    schedule();
    const id = setInterval(() => {
      speakRef.current();
      schedule();
    }, ms);
    return () => {
      clearInterval(id);
      setNextAt(null);
    };
  }, [autoEvery, done]);

  return (
    <Card title="Exercise & sleep adherence" className="flex flex-col">
      <div className="flex flex-wrap justify-around gap-4">
        <Ring
          pct={exPct}
          label={`${Math.round(exPct)}%`}
          sub={`${exerciseMinutes}/${exerciseTarget} MIN`}
          caption="Exercise today"
          stroke="stroke-mc-select"
        />
        <Ring
          pct={sleepPct}
          label={formatHours(sleepHours)}
          sub={`OF ${sleepTarget.toFixed(1)} H`}
          caption="Sleep last night"
          stroke="stroke-mc-violet"
        />
      </div>

      <ExerciseSection />
      <SleepSection bedtime={bedtime} />

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-mc-line pt-4">
        <button
          type="button"
          onClick={speak}
          className="min-h-9 rounded-md border border-mc-line-strong bg-[#0f182b] px-3.5 text-[13px] font-medium hover:bg-mc-raised"
        >
          🔊 Voice reminder
        </button>
        <label className="flex items-center gap-2 text-xs text-mc-muted">
          Auto
          <select
            value={autoEvery}
            onChange={(e) => setAutoEvery(Number(e.target.value))}
            className="rounded-md border border-mc-line-strong bg-mc-inset px-2 py-1.5 font-mono text-xs text-foreground"
          >
            <option value={0}>Off</option>
            <option value={1}>Every 1 min (demo)</option>
            <option value={15}>Every 15 min</option>
            <option value={30}>Every 30 min</option>
            <option value={60}>Every hour</option>
          </select>
        </label>
        {nextAt && <span className="font-mono text-[11px] text-mc-label">next {nextAt}</span>}
        {autoEvery > 0 && done && <span className="font-mono text-[11px] text-mc-green">exercise done, paused</span>}
      </div>
      {lastReminder && (
        <p className="mt-3 rounded-md border border-mc-line bg-mc-inset px-3 py-2 text-xs leading-relaxed text-mc-soft">
          {lastReminder}
        </p>
      )}
    </Card>
  );
}

function SourceTag({ source }: { source: "sensor" | "manual" }) {
  return source === "sensor" ? (
    <span className="rounded border border-[#1f4470] px-1.5 py-0.5 font-mono text-[10px] text-mc-link">✓ ACCEL + HRV</span>
  ) : (
    <span className="rounded border border-mc-line-strong px-1.5 py-0.5 font-mono text-[10px] text-mc-label">MANUAL</span>
  );
}

function ExerciseSection() {
  const { routine } = useMissionTelemetry();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ExerciseType>("treadmill");
  const [minutes, setMinutes] = useState(30);
  const [at, setAt] = useState(nowHHMM);

  return (
    <div className="mt-5 space-y-3">
      <div className="space-y-2">
        {routine.byType.map((t) => (
          <div key={t.type}>
            <div className="flex justify-between text-xs">
              <span className="text-mc-soft">{t.label}</span>
              <span className="font-mono text-mc-muted">
                {t.done}/{t.target} min
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-mc-line">
              <div
                className={`h-1.5 rounded-full ${t.done >= t.target ? "bg-mc-green" : "bg-mc-select"}`}
                style={{ width: `${Math.min(100, (t.done / t.target) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <ul className="space-y-1.5 text-xs">
        {routine.exercise.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className="w-11 font-mono text-mc-label">{s.at}</span>
            <span className="flex-1 text-mc-soft">
              {EXERCISE_PLAN[s.type].label.split(" (")[0]} · {s.minutes} min
            </span>
            <SourceTag source={s.source} />
            {s.source === "manual" && (
              <button
                type="button"
                onClick={() => routine.removeExercise(s.id)}
                aria-label="Remove session"
                className="px-1 text-mc-label hover:text-mc-red"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {open ? (
        <form
          className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (minutes > 0) routine.addExercise(type, minutes, at);
            setOpen(false);
          }}
        >
          <label className="mc-label">
            Machine
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExerciseType)}
              className="mt-1 w-full rounded-md border border-mc-line-strong bg-mc-inset px-2 py-1.5 text-xs normal-case tracking-normal text-foreground"
            >
              {(Object.keys(EXERCISE_PLAN) as ExerciseType[]).map((k) => (
                <option key={k} value={k}>
                  {EXERCISE_PLAN[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="mc-label">
            Min
            <input
              type="number"
              min={1}
              max={180}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="mt-1 w-16 rounded-md border border-mc-line-strong bg-mc-inset px-2 py-1.5 font-mono text-xs text-foreground"
            />
          </label>
          <label className="mc-label">
            Start
            <input
              type="time"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              className="mt-1 rounded-md border border-mc-line-strong bg-mc-inset px-2 py-1.5 font-mono text-xs text-foreground"
            />
          </label>
          <button type="submit" className="rounded-md border border-mc-select/60 bg-mc-select/15 px-3 py-1.5 text-mc-link">
            Add
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAt(nowHHMM());
            setOpen(true);
          }}
          className="text-xs text-mc-link hover:underline"
        >
          + Log exercise manually
        </button>
      )}
    </div>
  );
}

function SleepSection({ bedtime }: { bedtime: string }) {
  const { routine, sleepTarget } = useMissionTelemetry();
  const [open, setOpen] = useState(false);
  const [bed, setBed] = useState(routine.sleep.bed);
  const [wake, setWake] = useState(routine.sleep.wake);
  const hours = sleepDuration(routine.sleep);
  const debt = sleepTarget - hours;

  return (
    <div className="mt-5 space-y-2 border-t border-mc-line pt-4 text-xs">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-mc-soft">
          Last night {routine.sleep.bed} → {routine.sleep.wake} · {formatHours(hours)}
        </span>
        <SourceTag source={routine.sleep.source} />
      </div>
      <p className={debt > 0.25 ? "text-mc-amber" : "text-mc-green"}>
        {debt > 0.25
          ? `${formatHours(debt)} short of the ${sleepTarget} h target. Suggested lights out: ${bedtime}.`
          : "On target."}
      </p>
      {open ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            routine.setSleep(bed, wake);
            setOpen(false);
          }}
        >
          <label className="mc-label">
            Bedtime
            <input
              type="time"
              value={bed}
              onChange={(e) => setBed(e.target.value)}
              className="mt-1 block rounded-md border border-mc-line-strong bg-mc-inset px-2 py-1.5 font-mono text-xs text-foreground"
            />
          </label>
          <label className="mc-label">
            Wake
            <input
              type="time"
              value={wake}
              onChange={(e) => setWake(e.target.value)}
              className="mt-1 block rounded-md border border-mc-line-strong bg-mc-inset px-2 py-1.5 font-mono text-xs text-foreground"
            />
          </label>
          <span className="pb-2 font-mono text-mc-label">= {formatHours(sleepDuration({ bed, wake, source: "manual" }))}</span>
          <button type="submit" className="rounded-md border border-mc-violet/60 bg-mc-violet/15 px-3 py-1.5 text-foreground">
            Save
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setBed(routine.sleep.bed);
            setWake(routine.sleep.wake);
            setOpen(true);
          }}
          className="text-mc-link hover:underline"
        >
          Edit sleep manually
        </button>
      )}
    </div>
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
