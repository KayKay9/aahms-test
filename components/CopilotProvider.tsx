"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MLCEngine } from "@mlc-ai/web-llm";
import { assessRisk, riskLabel, type RiskLevel } from "@/lib/risk";
import { generateCopilotFallback } from "@/lib/copilotFallback";
import { getLatestForUser } from "@/lib/db";
import { getPvtSummary } from "@/components/PVTTest";
import type { CopilotChatMessage } from "@/components/CopilotChat";

const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

type EngineStatus = "idle" | "loading" | "ready" | "failed";

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
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("idle");
  const [loadProgress, setLoadProgress] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inferMs, setInferMs] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const engineRef = useRef<MLCEngine | null>(null);
  const initStartedRef = useRef(false);

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

  const initEngine = useCallback(async (force = false) => {
    if (!force && (initStartedRef.current || engineRef.current)) return;
    initStartedRef.current = true;
    setEngineStatus("loading");
    setLoadError(null);
    setLoadProgress("Checking WebGPU…");

    try {
      const nav = navigator as Navigator & { gpu?: unknown };
      if (typeof navigator !== "undefined" && !nav.gpu) {
        throw new Error(
          "WebGPU not available. Use Chrome or Edge 113+, or enable WebGPU in flags."
        );
      }

      const webllm = await import("@mlc-ai/web-llm");
      const e = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          const pct =
            report.progress !== undefined
              ? ` (${Math.round(report.progress * 100)}%)`
              : "";
          setLoadProgress(`${report.text}${pct}`);
        },
      });
      engineRef.current = e;
      setEngineStatus("ready");
      setLoadProgress("Model ready — on-device inference active");
    } catch (err) {
      initStartedRef.current = false;
      engineRef.current = null;
      setEngineStatus("failed");
      setLoadError(err instanceof Error ? err.message : "WebLLM init failed");
      setLoadProgress("");
    }
  }, []);

  useEffect(() => {
    void initEngine();
  }, [initEngine]);

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
      } else if (engineStatus !== "ready" || !engineRef.current) {
        assistantContent = generateCopilotFallback(userMsg, ctx);
      } else {
        const system = `You are the Flight Surgeon Co-Pilot on a Mars transit vehicle. Answer in 2-4 short sentences for crew health questions. Crew: ${userName}. Vitals: ${ctx.vitalsSummary}. Risk: ${riskLabel(risk)}. ${ctx.pvtSummary}. Voice: ${voiceTranscript}.`;

        const t0 = performance.now();
        try {
          const reply = await engineRef.current.chat.completions.create({
            messages: [
              { role: "system", content: system },
              ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
              { role: "user", content: userMsg },
            ],
            temperature: 0.4,
            max_tokens: 256,
          });
          setInferMs(Math.round(performance.now() - t0));
          assistantContent =
            reply.choices[0]?.message?.content?.trim() ||
            generateCopilotFallback(userMsg, ctx);
        } catch {
          assistantContent = generateCopilotFallback(userMsg, ctx);
        }
      }

      setMessages((m) => [...m, { role: "assistant", content: assistantContent }]);
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
    loadProgress,
    loadError,
    inferMs,
    retryEngine: () => void initEngine(true),
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
