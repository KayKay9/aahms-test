"use client";

import { useCallback, useEffect } from "react";
import { useVoiceCheckIn } from "./useVoiceCheckIn";
import { riskLabel } from "@/lib/risk";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { useSync } from "./SyncContext";
import { useCopilot } from "./CopilotProvider";
import { modelLabel } from "@/lib/webllm/engine";

type OfflineAICopilotProps = {
  userId: string;
  userName: string;
  /** The crew member whose vitals are on screen (may differ from the signed-in user). */
  patientName?: string;
  crewSummary?: string;
  displayVitals?: {
    heartRate: number;
    hrv: number;
    spo2: number;
    radiation: number;
  };
};

const RISK_TONE = {
  GREEN: { text: "text-mc-green", bg: "bg-mc-green/10 border-mc-green/30" },
  YELLOW: { text: "text-mc-amber", bg: "bg-mc-amber/10 border-mc-amber/40" },
  RED: { text: "text-mc-red", bg: "bg-mc-red/10 border-mc-red/50" },
} as const;

export function OfflineAICopilot({
  userId,
  userName,
  patientName,
  crewSummary,
  displayVitals,
}: OfflineAICopilotProps) {
  const { voiceStress } = useMissionTelemetry();
  const { unsyncedCount, syncNow, isSyncing, isOnline } = useSync();
  const {
    setSession,
    voiceTranscript,
    setVoiceTranscript,
    engineStatus,
    loadPercent,
    modelCached,
    modelId,
    basicReason,
    inferMs,
    retryEngine,
    risk,
    setChatOpen,
  } = useCopilot();

  useEffect(() => {
    setSession({ userId, userName, patientName, crewSummary, displayVitals });
  }, [userId, userName, patientName, crewSummary, displayVitals, setSession]);

  const stressFromHrv = displayVitals?.hrv ?? 62;
  let stressIndex = Math.max(0, Math.min(100, Math.round(100 - stressFromHrv)));
  if (voiceStress) stressIndex = Math.min(100, stressIndex + 25);
  const stressLabel = stressIndex < 40 ? "low" : stressIndex < 70 ? "moderate" : "elevated";

  const applyVoiceTranscript = useCallback(
    (text: string) => {
      setVoiceTranscript(`"${userName}: ${text}"`);
    },
    [userName, setVoiceTranscript]
  );
  const voice = useVoiceCheckIn(applyVoiceTranscript);
  const tone = RISK_TONE[risk];

  return (
    <aside aria-label="AI co-pilot" className="flex flex-col gap-4 self-start lg:sticky lg:top-6">
      {/* 1. The answer first: is the crew OK? */}
      <section className={`rounded-lg border p-5 ${tone.bg}`}>
        <p className="mc-label">Medical assessment</p>
        <p className={`mt-1 text-2xl font-semibold ${tone.text}`}>{riskLabel(risk)}</p>
        <p className="mt-2 text-sm leading-relaxed text-mc-soft">
          {risk === "GREEN"
            ? "No acute findings. Crew within their own baselines."
            : risk === "YELLOW"
              ? "Some readings are outside baseline. Review vitals and cabin air."
              : "A crew member needs attention now. Ask the co-pilot for steps."}
        </p>
        <p className="mt-3 font-mono text-xs text-mc-label">
          Stress {stressIndex}/100 · {stressLabel}
        </p>
      </section>

      {/* 2. The co-pilot and how it is running */}
      <section className="flex flex-col gap-3 rounded-lg border border-mc-line bg-mc-panel p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Flight Surgeon Co-Pilot</p>
          <AiBadge status={engineStatus} />
        </div>

        {engineStatus === "loading" && (
          <div>
            <div className="h-1.5 overflow-hidden rounded bg-mc-line">
              <div
                className={`h-full bg-mc-cyan transition-[width] duration-300 ${loadPercent == null ? "w-1/3 animate-pulse" : ""}`}
                style={loadPercent == null ? undefined : { width: `${Math.round(loadPercent * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-mc-label">
              {modelCached ? "Loading the AI from this device" : "Downloading the AI once"}
              {loadPercent != null && ` · ${Math.round(loadPercent * 100)}%`}. Basic answers work meanwhile.
            </p>
          </div>
        )}
        {engineStatus === "basic" && (
          <div className="rounded-md border border-mc-amber/30 bg-mc-amber/5 p-3 text-xs leading-relaxed text-mc-soft">
            <p className="font-semibold text-mc-amber">AI running in basic mode</p>
            <p className="mt-1">
              Answers come from the built-in triage rules. {basicReason}
            </p>
            <button type="button" onClick={retryEngine} className="mt-1.5 text-mc-link underline">
              Try the full AI again
            </button>
          </div>
        )}
        {engineStatus === "ready" && (
          <p className="text-xs text-mc-label">
            {modelLabel(modelId)} on this device{inferMs != null && ` · last answer ${inferMs} ms`}
          </p>
        )}

        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="min-h-11 rounded-md border border-mc-nasa-edge bg-mc-nasa text-sm font-semibold text-white"
        >
          Ask the co-pilot
        </button>
        <button
          type="button"
          onClick={voice.isListening ? voice.stop : voice.supported ? voice.start : voice.runPromptFallback}
          className={`min-h-11 rounded-md border text-sm font-medium ${
            voice.isListening ? "border-mc-red/60 bg-mc-red/10 text-mc-red" : "border-mc-line-strong text-mc-soft hover:text-white"
          }`}
        >
          {voice.isListening ? "Stop listening" : voice.supported ? "Voice check-in" : "Type a check-in"}
        </button>
        {(voice.interim || voice.error) && (
          <p className={`text-xs ${voice.error ? "text-mc-red" : "text-mc-cyan"}`}>{voice.error ?? `…${voice.interim}`}</p>
        )}
        <p className="text-xs leading-relaxed text-mc-label">
          Last check-in: <span className="text-mc-soft">{voiceTranscript}</span>
        </p>
      </section>

      {/* 3. Data link */}
      <section className="flex items-center justify-between gap-3 rounded-lg border border-mc-line bg-mc-panel px-5 py-3.5">
        <p className="text-[13px] text-mc-soft">
          <span className="font-mono text-white">{unsyncedCount}</span> records waiting
          <span className={isOnline ? "text-mc-label" : "text-mc-amber"}>{isOnline ? " · online" : " · no link"}</span>
        </p>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={isSyncing || unsyncedCount === 0}
          className="whitespace-nowrap rounded-md border border-mc-nasa-edge px-3 py-1.5 text-xs font-semibold text-[#b5d2ff] disabled:opacity-40"
        >
          {isSyncing ? "Syncing…" : "Sync to Earth"}
        </button>
      </section>
    </aside>
  );
}

function AiBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    ready: ["Full AI", "border-[#1f5f48] text-mc-green"],
    loading: ["Loading", "border-mc-line-strong text-mc-cyan"],
    basic: ["Basic mode", "border-mc-amber/40 text-mc-amber"],
    idle: ["Starting", "border-mc-line-strong text-mc-label"],
  };
  const [label, cls] = map[status] ?? map.idle;
  return <span className={`rounded border px-2 py-0.5 font-mono text-[11px] ${cls}`}>{label}</span>;
}
