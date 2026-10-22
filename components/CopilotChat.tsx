"use client";

import { useEffect, useRef } from "react";

export type CopilotChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function CopilotChat({
  messages,
  input,
  onInputChange,
  onSend,
  placeholder,
  isSending = false,
  className = "h-[min(420px,55vh)]",
}: {
  messages: CopilotChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  isSending?: boolean;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-cyan-900/50 bg-[#060a12]/95 shadow-lg shadow-black/40 ring-1 ring-cyan-500/10 ${className}`}
    >
      <div className="shrink-0 border-b border-cyan-900/40 px-3 py-2">
        <p className="text-xs font-medium text-cyan-300">Ask co-pilot</p>
        <p className="text-[10px] text-slate-600">Onboard · session only</p>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 py-3"
      >
        {messages.length === 0 && (
          <p className="px-2 text-center text-[11px] text-slate-600">
            Ask about symptoms, vitals, or emergency steps.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-cyan-600/25 text-cyan-50 border border-cyan-500/20"
                  : "rounded-bl-md bg-slate-800/80 text-slate-300 border border-slate-700/50"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-slate-700/50 bg-slate-800/80 px-3 py-2 text-xs text-slate-500">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
      </div>

      <div className="shrink-0 border-t border-cyan-900/40 bg-[#0a1020]/90 p-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder}
            disabled={isSending}
            className="min-w-0 flex-1 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-600/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={isSending || !input.trim()}
            className="shrink-0 rounded-full bg-cyan-600 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
