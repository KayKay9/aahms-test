"use client";

import { useCallback, useEffect } from "react";
import { useVoiceCheckIn } from "./useVoiceCheckIn";
import { Card } from "./ui/Card";
import { Gauge } from "./ui/Gauge";
import { riskLabel } from "@/lib/risk";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { useSync } from "./SyncContext";
import { useCopilot } from "./CopilotProvider";

type OfflineAICopilotProps = {
  userId: string;
  userName: string;
  displayVitals?: {
    heartRate: number;
    hrv: number;
    spo2: number;
    radiation: number;
  };
};

export function OfflineAICopilot({
  userId,
  userName,
  displayVitals,
}: OfflineAICopilotProps) {
  const { voiceStress } = useMissionTelemetry();
  const { unsyncedCount, syncNow, isSyncing, isOnline } = useSync();
  const {
    setSession,
    voiceTranscript,
    setVoiceTranscript,
    engineStatus,
    loadProgress,
    loadError,
    inferMs,
    retryEngine,
    risk,
    setChatOpen,
  } = useCopilot();

  useEffect(() => {
    setSession({ userId, userName, displayVitals });
  }, [userId, userName, displayVitals, setSession]);

  const stressFromHrv = displayVitals?.hrv ?? 62;
  let stressIndex = Math.max(0, Math.min(100, Math.round(100 - stressFromHrv)));
  if (voiceStress) stressIndex = Math.min(100, stressIndex + 25);

  const applyVoiceTranscript = useCallback(
    (text: string) => {
      setVoiceTranscript(`"${userName}: ${text}"`);
    },
    [userName, setVoiceTranscript]
  );

  const voice = useVoiceCheckIn(applyVoiceTranscript);

  const statusLine =
    engineStatus === "ready"
      ? "WebLLM ready"
      : engineStatus === "loading"
        ? loadProgress || "Downloading model weights…"
        : engineStatus === "failed"
          ? loadError ?? "WebLLM unavailable"
          : "Starting…";

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-72 lg:shrink-0">
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-cyan-300">Onboard Medical AI</p>
          <div className="flex gap-1">
            <span className="rounded bg-cyan-500/20 px-1 text-[9px] text-cyan-400">
              WebLLM
            </span>
            <span
              className={`rounded px-1 text-[9px] ${
                engineStatus === "ready"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-violet-500/20 text-violet-300"
              }`}
            >
              {engineStatus === "ready" ? "WebGPU OK" : "WebGPU"}
            </span>
          </div>
        </div>
        <p className="mb-3 text-[10px] text-slate-500">Flight Surgeon Co-Pilot</p>
        <Gauge
          value={stressIndex}
          max={100}
          label="Crew stress index"
          sublabel={
            stressIndex < 40 ? "Low" : stressIndex < 70 ? "Moderate" : "Elevated"
          }
        />
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          Voice prosody and HRV fused on-device. No crew audio leaves the vehicle.
        </p>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="mt-3 w-full rounded-lg border border-cyan-600/40 bg-cyan-500/10 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
        >
          Open co-pilot chat
        </button>
      </Card>

      <Card title="Last voice check-in">
        <p className="text-xs italic text-slate-400">{voiceTranscript}</p>
        {voice.interim && (
          <p className="mt-1 text-[10px] text-cyan-500/80">…{voice.interim}</p>
        )}
        {voice.error && (
          <p className="mt-1 text-[10px] text-red-400/90">{voice.error}</p>
        )}
        <div className="mt-2 flex flex-col gap-1.5">
          {voice.isListening ? (
            <button
              type="button"
              onClick={voice.stop}
              className="w-full rounded border border-red-500/50 bg-red-500/10 py-1.5 text-xs text-red-300"
            >
              Stop listening
            </button>
          ) : (
            <button
              type="button"
              onClick={voice.start}
              disabled={!voice.supported}
              className="w-full rounded border border-cyan-500/50 bg-cyan-500/10 py-1.5 text-xs text-cyan-200 disabled:opacity-40"
            >
              {voice.supported ? "Start voice check-in (mic)" : "Mic STT unavailable"}
            </button>
          )}
          <button
            type="button"
            onClick={voice.runPromptFallback}
            className="w-full rounded border border-cyan-900 py-1 text-[10px] text-slate-500 hover:text-slate-300"
          >
            Type check-in instead
          </button>
        </div>
        <p className="mt-2 text-[9px] leading-snug text-slate-600">
          Browser speech (Chrome/Edge). Transcript feeds the co-pilot chat.
        </p>
      </Card>

      <Card title="Medical assessment">
        <p
          className={`text-sm font-medium ${risk === "GREEN" ? "text-emerald-400" : "text-amber-400"}`}
        >
          {riskLabel(risk)}
        </p>
        <p className="text-xs text-slate-400">
          {risk === "GREEN" ? "No acute findings." : "Review vitals and cabin environment."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-mono text-slate-500">
          <span>{engineStatus === "ready" ? "CONF 98%" : "CONF rules"}</span>
          {inferMs != null && <span>INFER {inferMs} MS</span>}
          <span>LLAMA-3.2-1B-Q4</span>
        </div>
        <p
          className={`mt-2 text-[10px] ${
            engineStatus === "failed" ? "text-red-400/90" : "text-amber-400/80"
          }`}
        >
          {statusLine}
        </p>
        {engineStatus === "failed" && (
          <button
            type="button"
            onClick={retryEngine}
            className="mt-2 text-[10px] text-cyan-400 underline"
          >
            Retry WebLLM load
          </button>
        )}
      </Card>

      <Card>
        <p className="text-xs text-slate-400">
          <span className="font-mono text-cyan-200">{unsyncedCount}</span> records
          cached offline · IndexedDB
        </p>
        <p className="text-[10px] text-slate-600">
          {isOnline ? "Link available" : "LOS — queue active"}
        </p>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={isSyncing || unsyncedCount === 0}
          className="mt-2 w-full rounded bg-cyan-600 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          {isSyncing ? "Syncing…" : "Sync to Earth"}
        </button>
      </Card>
    </aside>
  );
}
