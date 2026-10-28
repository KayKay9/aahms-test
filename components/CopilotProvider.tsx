"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { assessRisk, describeVitals, riskLabel, type RiskLevel } from "@/lib/risk";
import { generateCopilotFallback } from "@/lib/copilotFallback";
import { evaRecommendation, findProtocols, protocolsForReadings } from "@/lib/copilotKnowledge";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { getLatestForUser } from "@/lib/db";
import { getPvtSummary } from "@/components/PVTTest";
import type { CopilotChatMessage } from "@/components/CopilotChat";
import {
  getEngine,
  preloadEngine,
  useWebLLM,
  type EngineStatus,
} from "@/lib/webllm/engine";

export type CopilotSession = {
  userId: string;
  userName: string;
  patientName?: string;
  crewSummary?: string;
  displayVitals?: {
    heartRate: number;
    hrv: number;
    spo2: number;
    radiation: number;
  };
};

type CopilotContextValue = {
  session: CopilotSession | null;
  setSession: (session: CopilotSession) => void;
  voiceTranscript: string;
  setVoiceTranscript: (t: string) => void;
  messages: CopilotChatMessage[];
  input: string;
  setInput: (v: string) => void;
  sendMessage: () => Promise<void>;
  isSending: boolean;
  engineStatus: EngineStatus;
  loadProgress: string;
  loadPercent: number | null;
  modelCached: boolean | null;
  modelId: string | null;
  basicReason: string | null;
  inferMs: number | null;
  retryEngine: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  risk: RiskLevel;
};

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<CopilotSession | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [input, setInput] = useState("");
  const llm = useWebLLM();
  const telemetry = useMissionTelemetry();
  const engineStatus = llm.status;
  const [inferMs, setInferMs] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const setSession = useCallback((s: CopilotSession) => {
    setSessionState(s);
    setVoiceTranscript(
      (prev) =>
        prev ||
        `"EV1 ${s.userName}: nominal systems, ready for EVA prep."`
    );
  }, []);

  const risk = session?.displayVitals
    ? assessRisk(session.displayVitals)
    : "GREEN";

  // Load the model once the console has rendered and the browser is idle, so the
  // download and GPU init never compete with sign-in or the first dashboard fetch.
  useEffect(() => {
    const start = () => void preloadEngine();
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(start, 1500);
    return () => clearTimeout(id);
  }, []);

  const buildContext = useCallback(async () => {
    const userId = session?.userId ?? "";
    const userName = session?.userName ?? "Crew";
    const displayVitals = session?.displayVitals;
    // Prefer what is on screen: the local queue holds the signed-in user's own readings,
    // which are stale or unrelated when viewing another crew member.
    const latest = !displayVitals && userId ? await getLatestForUser(userId) : undefined;
    const shown = displayVitals ?? latest;
    const vitalsCtx = shown ? describeVitals(shown) : "no vitals available";

    return {
      userName,
      vitalsSummary: vitalsCtx,
      risk,
      pvtSummary: getPvtSummary(),
      webLlmReady: engineStatus === "ready",
    };
  }, [session, risk, engineStatus]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setIsSending(true);

    try {
      const ctx = await buildContext();
      let assistantContent: string;
      const userName = session?.userName ?? "Crew";

      // While the model is still warming up, wait for it rather than replying with a canned
      // rule-based answer that ignores the question.
      if (engineStatus === "loading" || engineStatus === "idle") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Warming up the on-device AI, your answer will appear here shortly…", streaming: true },
        ]);
        await preloadEngine();
      }

      if (!getEngine()) {
        assistantContent = generateCopilotFallback(userMsg, ctx);
      } else {
        // A 1B model follows short, explicit rules and labelled data far better than one
        // dense sentence, and it invents facts unless told to stick to the data given.
        const patient = session?.patientName ?? userName;
        const shown = session?.displayVitals;
        // Onboard protocols for this question, plus any triggered by out-of-range readings.
        const protocols = findProtocols(
          userMsg,
          protocolsForReadings({ ...shown, ppCO2: telemetry.ppCO2, arrhythmia: telemetry.arrhythmia })
        );
        const system = [
          "You are the Flight Surgeon Co-Pilot on a Mars transit spacecraft. You help the crew with medical questions.",
          "Rules:",
          "- Answer the user's actual question first, directly.",
          "- Use only the data and onboard protocols below. If they do not answer it, say so; never invent diagnoses, syndromes or numbers.",
          "- Each value below is already marked (normal), (HIGH) or (LOW). Trust those marks; do not re-judge the numbers.",
          "- When asked who needs attention, use the 'Needs attention' line and name everyone on it.",
          "- Base next steps on the onboard protocols. Keep it to 2-5 short sentences, plain text, no lists.",
          "",
          "CREW DATA",
          `Signed-in user: ${userName}.`,
          `Crew member on screen: ${patient}. Vitals: ${ctx.vitalsSummary}. Status: ${riskLabel(risk)}.${
            telemetry.arrhythmia ? " ECG shows an irregular rhythm." : ""
          }`,
          `EVA readiness for ${patient}: ${evaRecommendation({
            ...shown,
            sleepHours: telemetry.sleepHours,
            arrhythmia: telemetry.arrhythmia,
          })}.`,
          session?.crewSummary ?? "",
          "",
          "HABITAT",
          `Cabin ppCO2 ${telemetry.ppCO2.toFixed(1)} mmHg (limit 4.0)${telemetry.ppCO2 > 4 ? " (HIGH)" : " (normal)"}. Radiation ${telemetry.radiation.toFixed(3)} mSv/h${
            telemetry.radiation >= 0.1 ? " (HIGH)" : " (normal)"
          }${telemetry.shieldingBoost ? ", shielding/scrubber boost on" : ""}.`,
          `Exercise today ${telemetry.exerciseMinutes}/${telemetry.exerciseTarget} min. Last sleep ${telemetry.sleepHours} h of ${telemetry.sleepTarget} h target.`,
          `Cognitive test: ${ctx.pvtSummary}.`,
          `Latest voice check-in: ${voiceTranscript || "none"}${telemetry.voiceStress ? " (voice stress detected)" : ""}.`,
          "",
          "ONBOARD PROTOCOLS",
          ...protocols.map((p) => `${p.title}: ${p.text}`),
        ]
          .filter((line, i, all) => line !== "" || all[i - 1] !== "")
          .join("\n");

        const t0 = performance.now();
        // Stream tokens into the chat so the crew sees the answer forming instead of
        // waiting for the whole reply (decode can be a few tokens/s on laptop GPUs).
        const showPartial = (content: string) =>
          setMessages((m) => {
            const last = m[m.length - 1];
            return last?.role === "assistant" && last.streaming
              ? [...m.slice(0, -1), { role: "assistant", content, streaming: true }]
              : [...m, { role: "assistant", content, streaming: true }];
          });
        try {
          const stream = await getEngine()!.chat.completions.create({
            messages: [
              { role: "system", content: system },
              // One worked example shows the 1B model the expected length and grounding.
              { role: "user", content: "Is Park okay?" },
              {
                role: "assistant",
                content:
                  "Yes. Park's heart rate, SpO2 and HRV are all normal and the status is NOMINAL. No action needed; keep routine monitoring.",
              },
              // Recent turns only: canned basic-mode replies and long history drown out the new question.
              ...messages
                .filter((msg) => !msg.content.startsWith("[Basic mode"))
                .slice(-6)
                .map((msg) => ({ role: msg.role, content: msg.content })),
              { role: "user", content: userMsg },
            ],
            temperature: 0.2,
            max_tokens: 320,
            stream: true,
          });
          let text = "";
          for await (const chunk of stream) {
            text += chunk.choices[0]?.delta?.content ?? "";
            if (text) showPartial(text);
          }
          setInferMs(Math.round(performance.now() - t0));
          // Small models sometimes wrap the whole reply in quotes or add markdown bold,
          // which the chat shows as raw characters.
          const cleaned = text.trim().replace(/^"([\s\S]*)"$/, "$1").replace(/\*\*/g, "");
          assistantContent = cleaned || generateCopilotFallback(userMsg, ctx);
        } catch {
          assistantContent = generateCopilotFallback(userMsg, ctx);
        }
      }

      setMessages((m) => [
        ...m.filter((msg) => !msg.streaming),
        { role: "assistant", content: assistantContent },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [
    input,
    isSending,
    buildContext,
    engineStatus,
    messages,
    session,
    risk,
    voiceTranscript,
    telemetry,
  ]);

  const toggleChat = useCallback(() => setChatOpen((o) => !o), []);

  const value: CopilotContextValue = {
    session,
    setSession,
    voiceTranscript,
    setVoiceTranscript,
    messages,
    input,
    setInput,
    sendMessage,
    isSending,
    engineStatus,
    loadProgress: llm.text,
    loadPercent: llm.progress,
    modelCached: llm.cached,
    modelId: llm.model,
    basicReason: llm.reason,
    inferMs,
    retryEngine: () => void preloadEngine(true),
    chatOpen,
    setChatOpen,
    toggleChat,
    risk,
  };

  return (
    <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
  );
}

export function useCopilot() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error("useCopilot requires CopilotProvider");
  return ctx;
}
