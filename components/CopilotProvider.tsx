"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { assessRisk, riskLabel, type RiskLevel } from "@/lib/risk";
import { generateCopilotFallback } from "@/lib/copilotFallback";
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
  loadError: string | null;
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
    const latest = userId ? await getLatestForUser(userId) : undefined;
    const vitalsCtx = latest
      ? `HR ${latest.heartRate}, HRV ${Math.round(latest.hrv)}, SpO₂ ${latest.spo2}%, rad ${latest.radiation} mSv/h`
      : displayVitals
        ? `HR ${displayVitals.heartRate}, HRV ${displayVitals.hrv}, SpO₂ ${displayVitals.spo2}%`
        : "no local vitals cached";

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

      if (engineStatus === "loading") {
        assistantContent = generateCopilotFallback(userMsg, {
          ...ctx,
          webLlmReady: false,
        });
      } else if (engineStatus !== "ready" || !getEngine()) {
        assistantContent = generateCopilotFallback(userMsg, ctx);
      } else {
        const system = `You are the Flight Surgeon Co-Pilot on a Mars transit vehicle. Answer in 2-4 short sentences for crew health questions. Crew: ${userName}. Vitals: ${ctx.vitalsSummary}. Risk: ${riskLabel(risk)}. ${ctx.pvtSummary}. Voice: ${voiceTranscript}.`;

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
              ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
              { role: "user", content: userMsg },
            ],
            temperature: 0.4,
            max_tokens: 160,
            stream: true,
          });
          let text = "";
          for await (const chunk of stream) {
            text += chunk.choices[0]?.delta?.content ?? "";
            if (text) showPartial(text);
          }
          setInferMs(Math.round(performance.now() - t0));
          assistantContent = text.trim() || generateCopilotFallback(userMsg, ctx);
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
    loadError: llm.error,
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
