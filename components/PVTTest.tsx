"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./ui/Card";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";

const PVT_STORAGE_KEY = "aahms_pvt_summary";

export function PVTTest() {
  const { pvtSlowdown } = useMissionTelemetry();
  const [phase, setPhase] = useState<"idle" | "wait" | "go" | "done">("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [message, setMessage] = useState("Press Start — respond when the panel turns green");
  const startRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTrial = useCallback(() => {
    setPhase("wait");
    setMessage("Wait for green…");
    const delay = 2000 + Math.random() * 4000;
    timeoutRef.current = setTimeout(() => {
      startRef.current = performance.now();
      setPhase("go");
      setMessage("TAP NOW (Space)");
    }, delay);
  }, []);

  const recordHit = useCallback(() => {
    if (phase !== "go") return;
    const rt = performance.now() - startRef.current;
    const adjusted = pvtSlowdown ? rt * 1.35 + 80 : rt;
    setTimes((t) => [...t, adjusted]);
    setPhase("idle");
    setMessage(`Reaction: ${Math.round(adjusted)} ms`);
  }, [phase, pvtSlowdown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "go") recordHit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, recordHit]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const mean =
    times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const lapses = times.filter((t) => t > 500).length;

  useEffect(() => {
    if (times.length >= 5) {
      localStorage.setItem(
        PVT_STORAGE_KEY,
        JSON.stringify({ mean, lapses, at: Date.now() })
      );
    }
  }, [times, mean, lapses]);

  return (
    <Card title="Cognitive PVT lab">
      <p className="mb-3 text-xs text-slate-400">
        Psychomotor vigilance test — fatigue indicator
        {pvtSlowdown && (
          <span className="ml-2 text-amber-400">ppCO₂ slowdown active</span>
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          if (phase === "go") recordHit();
          else if (phase === "idle") startTrial();
        }}
        className={`mb-4 flex h-32 w-full items-center justify-center rounded-lg border-2 text-sm font-medium transition ${
          phase === "go"
            ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
            : "border-cyan-900/50 bg-[#0a1020] text-slate-400 hover:border-cyan-700"
        }`}
      >
        {message}
      </button>
      <div className="flex gap-6 font-mono text-sm text-slate-300">
        <span>Trials: {times.length}</span>
        <span>Mean RT: {times.length ? `${Math.round(mean)} ms` : "—"}</span>
        <span>Lapses (&gt;500ms): {lapses}</span>
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
