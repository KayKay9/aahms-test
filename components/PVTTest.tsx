"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./ui/Card";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";

const PVT_STORAGE_KEY = "aahms_pvt_summary";
const DURATIONS = [1, 3, 5] as const;
const SQUARE_PX = 56;

/** x and y are 0–1 fractions of the free space inside the arena. */
type Target = { x: number; y: number; shownAt: number };

export function PVTTest() {
  const { pvtSlowdown } = useMissionTelemetry();
  const [minutes, setMinutes] = useState<(typeof DURATIONS)[number]>(1);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [target, setTarget] = useState<Target | null>(null);
  const [times, setTimes] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [lastRt, setLastRt] = useState<number | null>(null);
  const endAtRef = useRef(0);
  const gapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGap = () => {
    if (gapRef.current) clearTimeout(gapRef.current);
    gapRef.current = null;
  };

  // A short random gap before each square keeps the timing unpredictable, as in a real PVT.
  const queueTarget = useCallback(() => {
    clearGap();
    gapRef.current = setTimeout(() => {
      setTarget({
        x: Math.random(),
        y: Math.random(),
        shownAt: performance.now(),
      });
    }, 400 + Math.random() * 1100);
  }, []);

  const start = () => {
    setTimes([]);
    setMisses(0);
    setLastRt(null);
    setTarget(null);
    endAtRef.current = Date.now() + minutes * 60_000;
    setRemaining(minutes * 60);
    setPhase("running");
    queueTarget();
  };

  const finish = useCallback(() => {
    clearGap();
    setTarget(null);
    setPhase("done");
  }, []);

  const hit = () => {
    if (!target) return;
    const rt = performance.now() - target.shownAt;
    const adjusted = pvtSlowdown ? rt * 1.35 + 80 : rt;
    setTimes((t) => [...t, adjusted]);
    setLastRt(adjusted);
    setTarget(null);
    queueTarget();
  };

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) finish();
    }, 250);
    return () => clearInterval(id);
  }, [phase, finish]);

  useEffect(() => clearGap, []);

  const mean =
    times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const lapses = times.filter((t) => t > 500).length;

  useEffect(() => {
    if (phase === "done" && times.length > 0) {
      localStorage.setItem(
        PVT_STORAGE_KEY,
        JSON.stringify({ mean, lapses, at: Date.now() })
      );
    }
  }, [phase, times, mean, lapses]);

  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <Card title="Cognitive PVT lab">
      <p className="mb-3 text-xs text-slate-400">
        Psychomotor vigilance test — click each square as fast as you can
        {pvtSlowdown && (
          <span className="ml-2 text-amber-400">ppCO₂ slowdown active</span>
        )}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Duration</span>
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            disabled={phase === "running"}
            onClick={() => setMinutes(m)}
            aria-pressed={minutes === m}
            className={`rounded-md border px-3 py-1.5 font-mono transition disabled:opacity-50 ${
              minutes === m
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                : "border-cyan-900/50 text-slate-400 hover:border-cyan-700"
            }`}
          >
            {m} min
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2">
          {phase === "running" && (
            <span className="font-mono text-sm text-slate-200">{clock}</span>
          )}
          {phase === "running" ? (
            <button
              type="button"
              onClick={finish}
              className="rounded-md border border-red-500/50 px-3 py-1.5 text-red-300 hover:bg-red-500/10"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              className="rounded-md border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-emerald-200 hover:bg-emerald-500/25"
            >
              {phase === "done" ? "Restart" : "Start"}
            </button>
          )}
        </span>
      </div>

      <div
        role="presentation"
        onClick={() => {
          if (phase === "running") setMisses((n) => n + 1);
        }}
        className="relative mb-4 h-64 w-full select-none overflow-hidden rounded-lg border-2 border-cyan-900/50 bg-[#0a1020]"
      >
        {phase !== "running" && (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
            {phase === "done"
              ? `Done: ${times.length} squares, mean ${times.length ? Math.round(mean) : "—"} ms, ${lapses} lapses, ${misses} misses`
              : "Pick a duration and press Start. Click each square as soon as it appears."}
          </div>
        )}
        {phase === "running" && target && (
          <button
            type="button"
            aria-label="Target square"
            onClick={(e) => {
              e.stopPropagation();
              hit();
            }}
            style={{
              left: `calc((100% - ${SQUARE_PX}px) * ${target.x})`,
              top: `calc((100% - ${SQUARE_PX}px) * ${target.y})`,
              width: SQUARE_PX,
              height: SQUARE_PX,
            }}
            className="absolute rounded-md border-2 border-emerald-300 bg-emerald-500/70 shadow-[0_0_18px_rgba(16,185,129,0.6)]"
          />
        )}
        {phase === "running" && lastRt !== null && (
          <span className="pointer-events-none absolute bottom-2 right-3 font-mono text-xs text-slate-500">
            last {Math.round(lastRt)} ms
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-6 font-mono text-sm text-slate-300">
        <span>Hits: {times.length}</span>
        <span>Mean RT: {times.length ? `${Math.round(mean)} ms` : "—"}</span>
        <span>Lapses (&gt;500ms): {lapses}</span>
        <span>Misses: {misses}</span>
      </div>
    </Card>
  );
}

export function getPvtSummary(): string {
  try {
    const raw = localStorage.getItem(PVT_STORAGE_KEY);
    if (!raw) return "No PVT data";
    const { mean, lapses } = JSON.parse(raw);
    return `PVT mean ${Math.round(mean)} ms, ${lapses} lapses`;
  } catch {
    return "No PVT data";
  }
}
