"use client";

import { CopilotChat } from "./CopilotChat";
import { useCopilot } from "./CopilotProvider";

export function CopilotFloatingLauncher() {
  const {
    chatOpen,
    toggleChat,
    setChatOpen,
    messages,
    input,
    setInput,
    sendMessage,
    isSending,
    engineStatus,
    loadPercent,
    session,
  } = useCopilot();

  if (!session) return null;

  return (
    <>
      {chatOpen && (
        <div
          className="fixed bottom-20 left-4 z-[100] w-[min(calc(100vw-2rem),400px)]"
          role="dialog"
          aria-label="Flight Surgeon Co-Pilot chat"
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-sm text-slate-300 shadow-lg hover:bg-slate-700"
              aria-label="Close chat"
            >
              ×
            </button>
            <CopilotChat
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSend={() => void sendMessage()}
              isSending={isSending}
              className="h-[min(480px,70vh)]"
              placeholder={
                engineStatus === "loading"
                  ? `AI loading${loadPercent != null ? ` ${Math.round(loadPercent * 100)}%` : ""}. Basic answers work now…`
                  : engineStatus === "basic"
                    ? "Basic mode: ask about symptoms or emergencies…"
                    : "Ask about symptoms, vitals or emergencies…"
              }
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggleChat}
        className={`fixed bottom-4 left-4 z-[100] flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-lg shadow-cyan-900/40 transition ${
          chatOpen
            ? "border border-cyan-500/50 bg-slate-800 text-cyan-200"
            : "border border-cyan-500/40 bg-cyan-600 text-white hover:bg-cyan-500"
        }`}
        aria-expanded={chatOpen}
        aria-label={chatOpen ? "Close co-pilot chat" : "Ask co-pilot"}
      >
        <span className="flex h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
        {chatOpen ? "Close co-pilot" : "Ask co-pilot"}
      </button>
    </>
  );
}
