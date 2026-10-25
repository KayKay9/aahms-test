"use client";

import { useCallback, useEffect } from "react";
import { useVoiceCheckIn } from "./useVoiceCheckIn";
import { CircularProgress } from "./ui/CircularProgress";
import { riskLabel } from "@/lib/risk";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { useSync } from "./SyncContext";
import { useCopilot } from "./CopilotProvider";
import { WEBLLM_MODEL_ID } from "@/lib/webllm/engine";

const MODEL_LABEL = WEBLLM_MODEL_ID.replace(/-MLC$/, "")
  .replace(/-Instruct/, "")
  .replace(/-q(\d)f\d+_\d$/, "-Q$1")
  .toUpperCase();

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
    loadPercent,
    modelCached,
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
      ? "WebLLM ready · on-device inference active"
      : engineStatus === "loading"
        ? loadProgress || "Downloading model weights…"
        : engineStatus === "failed"
          ? loadError ?? "WebLLM unavailable"
          : "Starting…";

  const stressLabel = stressIndex < 40 ? "Low" : stressIndex < 70 ? "Moderate" : "Elevated";
  const stressStroke =
    stressIndex < 40 ? "stroke-mc-green" : stressIndex < 70 ? "stroke-mc-amber" : "stroke-mc-red";
  const assessTone =
    risk === "GREEN" ? "text-mc-green" : risk === "YELLOW" ? "text-mc-amber" : "text-mc-red";
  const chip = "rounded bg-mc-raised px-2 py-1 font-mono text-[11px] text-mc-muted";

  return (
    <aside
      aria-label="Onboard medical AI"
      className="flex w-full min-w-0 flex-col self-start rounded-lg border border-mc-line bg-mc-panel lg:max-w-[520px] lg:flex-[1_1_400px]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-mc-line px-6 py-5">
        <div className="flex flex-col gap-1">
          <span className="mc-label">Onboard Medical AI</span>
          <span className="text-lg font-semibold">Flight Surgeon Co-Pilot</span>
        </div>
        <span
          className={`rounded border px-2 py-1 font-mono text-[11px] ${
            engineStatus === "ready" ? "border-[#1f5f48] text-mc-green" : "border-mc-line-strong text-mc-muted"
          }`}
        >
          WebLLM · WebGPU
        </span>
      </div>

      <div className="flex items-center gap-5 p-6">
        <CircularProgress
          size={132}
          strokeWidth={10}
          percent={stressIndex}
          trackClassName="stroke-mc-line"
          progressClassName={stressStroke}
        >
          <svg width="40" height="34" viewBox="0 0 40 34" aria-hidden="true">
            <g stroke="#5CC8FF" strokeWidth="3" strokeLinecap="round">
              <line x1="2" y1="13" x2="2" y2="21" />
              <line x1="8" y1="9" x2="8" y2="25" />
              <line x1="14" y1="5" x2="14" y2="29" />
              <line x1="20" y1="1" x2="20" y2="33" />
              <line x1="26" y1="5" x2="26" y2="29" />
              <line x1="32" y1="9" x2="32" y2="25" />
              <line x1="38" y1="13" x2="38" y2="21" />
            </g>
          </svg>
        </CircularProgress>
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="mc-label">Crew Stress Index</span>
            <span className="font-mono text-[28px] font-medium">
              {stressIndex}
              <span className="text-sm text-mc-label"> / 100 · {stressLabel}</span>
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-mc-muted">
            Voice prosody and HRV fused on-device. No crew audio leaves the vehicle.
          </p>
        </div>
      </div>

      <div className="mx-6 flex flex-col gap-1.5 rounded-md border border-mc-line bg-mc-inset px-4 py-3.5">
        <span className="mc-label">Last voice check-in · {userName}</span>
        <span className="text-sm leading-relaxed text-mc-soft">{voiceTranscript}</span>
        {voice.interim && <span className="text-xs text-mc-cyan">…{voice.interim}</span>}
        {voice.error && <span className="text-xs text-mc-red">{voice.error}</span>}
      </div>
      <div className="flex flex-col gap-2 px-6 pb-6 pt-4">
        {voice.isListening ? (
          <button
            type="button"
            onClick={voice.stop}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-mc-red/60 bg-mc-red/10 text-sm font-semibold text-mc-red"
          >
            Stop listening
          </button>
        ) : (
          <button
            type="button"
            onClick={voice.start}
            disabled={!voice.supported}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-mc-nasa-edge bg-mc-nasa text-sm font-semibold text-white disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <path d="M12 17v5" />
            </svg>
            {voice.supported ? `Run voice check-in · ${userName}` : "Mic speech-to-text unavailable"}
          </button>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={voice.runPromptFallback}
            className="min-h-9 flex-1 rounded-md border border-mc-line-strong text-xs text-mc-muted hover:text-white"
          >
            Type check-in instead
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="min-h-9 flex-1 rounded-md border border-mc-line-strong text-xs text-mc-link hover:text-white"
          >
            Open co-pilot chat
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 border-t border-mc-line px-6 py-5">
        <div className="flex items-center justify-between">
          <span className="mc-label">Medical Assessment</span>
          <span className={`font-mono text-xs font-semibold ${assessTone}`}>● {riskLabel(risk)}</span>
        </div>
        <p className="text-xl font-semibold">
          {risk === "GREEN"
            ? "No acute findings"
            : risk === "YELLOW"
              ? "Caution: review indicators"
              : "Warning: act on crew vitals"}
        </p>
        <p className="text-sm leading-relaxed text-mc-muted">
          {risk === "GREEN"
            ? "Crew within individual baselines for HR, HRV and SpO₂. Cabin ppCO₂ and dose rate inside flight rule limits."
            : "One or more crew indicators are outside baseline. Review vitals and cabin environment, then ask the co-pilot for a countermeasure."}
        </p>
        <div className="flex flex-wrap gap-2">
          <span className={chip}>{engineStatus === "ready" ? "CONF 98%" : "CONF RULES"}</span>
          {inferMs != null && <span className={chip}>INFER {inferMs} MS</span>}
          <span className={chip}>{MODEL_LABEL}</span>
        </div>
        <p className={`text-xs ${engineStatus === "failed" ? "text-mc-red" : "text-mc-label"}`}>{statusLine}</p>
        {engineStatus === "loading" && (
          <div>
            <div className="h-1 overflow-hidden rounded bg-mc-line">
              <div
                className={`h-full bg-mc-cyan transition-[width] duration-300 ${
                  loadPercent == null ? "w-1/3 animate-pulse" : ""
                }`}
                style={loadPercent == null ? undefined : { width: `${Math.round(loadPercent * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-mc-label">
              {modelCached
                ? "Weights cached on this device, no download needed."
                : "One-time download, then cached for offline use. Edge triage answers meanwhile."}
            </p>
          </div>
        )}
        {engineStatus === "failed" && (
          <button type="button" onClick={retryEngine} className="self-start text-xs text-mc-link underline">
            Retry WebLLM load
          </button>
        )}
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          disabled={risk === "GREEN"}
          className="min-h-12 w-full rounded-md border border-mc-line-strong bg-[#0f182b] text-sm font-semibold text-mc-label enabled:border-mc-amber enabled:text-mc-amber"
        >
          {risk === "GREEN" ? "No countermeasure required" : "Ask co-pilot for countermeasure"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-mc-line px-6 py-3.5">
        <span className="flex items-center gap-2.5 text-[13px] text-mc-soft">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5CC8FF" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <ellipse cx="12" cy="5" rx="8" ry="3" />
            <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
            <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
          </svg>
          <span>
            <span className="font-mono text-white">{unsyncedCount}</span> records cached offline · IndexedDB
            {!isOnline && <span className="text-mc-amber"> · LOS</span>}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={isSyncing || unsyncedCount === 0}
          className="whitespace-nowrap rounded-md border border-mc-nasa-edge px-3.5 py-2 text-xs font-semibold text-[#b5d2ff] disabled:opacity-40"
        >
          {isSyncing ? "Syncing…" : "Sync to Earth"}
        </button>
      </div>
    </aside>
  );
}
