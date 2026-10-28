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
import { describeProfile } from "@/lib/crewProfiles";
import { getLatestForUser } from "@/lib/db";
import { getPvtSummary } from "@/components/PVTTest";
import type { CopilotChatMessage } from "@/components/CopilotChat";
import {
  getEngine,
  preloadEngine,
  useWebLLM,
  type EngineStatus,
} from "@/lib/webllm/engine";

/** One crew member's latest reading and personal baseline, as the co-pilot sees them. */
export type CrewBrief = {
  name: string;
  callsign: string;
  risk: RiskLevel;
  vitals: { heartRate: number; hrv: number; spo2: number; radiation: number } | null;
  usualHr: number | null;
  usualHrv: number | null;
};

export type CopilotSession = {
  userId: string;
  userName: string;
  patientName?: string;
  crew?: CrewBrief[];
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

const MISSION_EPOCH = Date.UTC(2026, 0, 15);

function missionDay() {
  return Math.floor((Date.now() - MISSION_EPOCH) / 86_400_000) + 1;
}


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
        // Send detail only about the people the question is about: the whole crew's data,
        // profiles and protocols made prefill take minutes on a laptop GPU and confused
        // the model about who was who.
        const patient = session?.patientName ?? userName;
        const crew = session?.crew ?? [];
        const q = userMsg.toLowerCase();
        const named = crew.filter((m) => q.includes(m.name.toLowerCase()));
        const focus = named.length ? named : crew.filter((m) => m.name === patient);
        const flagged = crew.filter((m) => m.risk !== "GREEN").sort((a, b) => (a.risk === "RED" ? -1 : b.risk === "RED" ? 1 : 0));
        const detailed = [...focus, ...flagged.filter((m) => !focus.includes(m))].slice(0, 3);
        const others = crew.filter((m) => !detailed.includes(m));

        const vitalsOf = (m: CrewBrief) =>
          m.name === patient && session?.displayVitals ? session.displayVitals : m.vitals;
        const memberLine = (m: CrewBrief) => {
          const v = vitalsOf(m);
          if (!v) return `${m.name} (${m.callsign}): no readings yet.`;
          const usual = m.usualHr != null ? `; usual HR ${m.usualHr}, usual HRV ${m.usualHrv}` : "";
          const eva = evaRecommendation({ ...v, sleepHours: telemetry.sleepHours, arrhythmia: m.name === patient && telemetry.arrhythmia });
          return `${m.name} (${m.callsign}): ${describeVitals(v)}${usual}. Status ${riskLabel(m.risk)}. EVA: ${eva}.`;
        };

        const focusVitals = focus[0] ? vitalsOf(focus[0]) : undefined;
        const protocols = findProtocols(
          userMsg,
          protocolsForReadings({ ...focusVitals, ppCO2: telemetry.ppCO2, arrhythmia: telemetry.arrhythmia }),
          2
        );
        const habitatFlags = [
          telemetry.ppCO2 > 4 ? `cabin CO2 HIGH (${telemetry.ppCO2.toFixed(1)} mmHg)` : "",
          telemetry.radiation >= 0.1 ? `cabin radiation HIGH (${telemetry.radiation.toFixed(3)} mSv/h)` : "",
          telemetry.voiceStress ? "voice stress detected" : "",
          telemetry.arrhythmia ? `${patient}'s ECG shows an irregular rhythm` : "",
        ].filter(Boolean);

        const system = [
          "You are the Flight Surgeon Co-Pilot on a Mars transit spacecraft.",
          "Rules: answer the question first. Use only the data and protocols below; never invent diagnoses or numbers. Values are already marked (normal)/(HIGH)/(LOW); trust the marks. Check allergies before any medicine. Reply in 2-4 short plain sentences, in the user's language.",
          `Mission day ${missionDay()}; Earth is 20 min away one way. CMO: Silva. CDR: Vance.`,
          flagged.length
            ? `Needs attention, worst first: ${flagged.map((m) => `${m.name} (${riskLabel(m.risk)})`).join(", ")}.`
            : "Needs attention: nobody.",
          "CREW:",
          ...detailed.map(memberLine),
          others.length ? `All others NOMINAL: ${others.map((m) => m.name).join(", ")}.` : "",
          ...focus.slice(0, 2).map((m) => describeProfile(m.name)).filter((p): p is string => p !== null),
          habitatFlags.length ? `Habitat: ${habitatFlags.join("; ")}.` : "Habitat: cabin air and radiation normal.",
          `Sleep last night ${telemetry.sleepHours} h (target ${telemetry.sleepTarget}). ${ctx.pvtSummary}.`,
          "PROTOCOLS:",
          ...protocols.map((p) => `${p.title}: ${p.text}`),
        ]
          .filter(Boolean)
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
                .slice(-2)
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
