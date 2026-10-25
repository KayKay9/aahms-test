"use client";

import { useSyncExternalStore } from "react";
import type { MLCEngineInterface } from "@mlc-ai/web-llm";

/**
 * Model weights are cached by WebLLM in the browser Cache API, so only the very first
 * visit downloads them. Override with NEXT_PUBLIC_WEBLLM_MODEL (e.g. the much smaller
 * "SmolLM2-360M-Instruct-q4f16_1-MLC") for slow links or low-VRAM demo laptops.
 */
export const WEBLLM_MODEL_ID =
  process.env.NEXT_PUBLIC_WEBLLM_MODEL || "Llama-3.2-1B-Instruct-q4f16_1-MLC";

export type EngineStatus = "idle" | "loading" | "ready" | "failed";

export type EngineState = {
  status: EngineStatus;
  /** 0..1 while loading, null when unknown. */
  progress: number | null;
  text: string;
  error: string | null;
  /** Whether weights were already in the browser cache when loading began. */
  cached: boolean | null;
};

const IDLE: EngineState = {
  status: "idle",
  progress: null,
  text: "",
  error: null,
  cached: null,
};

// Module-level singleton: survives client-side navigation (login → console) and
// React remounts, so the model loads once per tab instead of once per mount.
let state: EngineState = IDLE;
let engine: MLCEngineInterface | null = null;
let worker: Worker | null = null;
let loading: Promise<MLCEngineInterface | null> | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<EngineState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEngine(): MLCEngineInterface | null {
  return engine;
}

async function load(): Promise<MLCEngineInterface | null> {
  setState({ status: "loading", progress: null, error: null, text: "Checking WebGPU…" });

  try {
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown> };
    }).gpu;
    if (!gpu || !(await gpu.requestAdapter())) {
      throw new Error(
        "WebGPU not available. Use Chrome or Edge 113+, or enable WebGPU in flags."
      );
    }

    // Ask the browser not to evict the cached weights under storage pressure.
    void navigator.storage?.persist?.().catch(() => false);

    const webllm = await import("@mlc-ai/web-llm");
    const cached = await webllm.hasModelInCache(WEBLLM_MODEL_ID).catch(() => false);
    setState({
      cached,
      progress: 0,
      text: cached
        ? "Loading cached model into GPU…"
        : "Downloading model weights (first run only)…",
    });

    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    const e = await webllm.CreateWebWorkerMLCEngine(worker, WEBLLM_MODEL_ID, {
      initProgressCallback: (report) => {
        setState({ progress: report.progress, text: report.text });
      },
    });

    // Compile the decode kernels now so the crew's first real question is not the slow one.
    setState({ progress: 1, text: "Warming up GPU kernels…" });
    await e.chat.completions.create({
      messages: [{ role: "user", content: "ok" }],
      max_tokens: 1,
    });
    await e.resetChat();

    engine = e;
    setState({ status: "ready", text: "Model ready — on-device inference active" });
    return e;
  } catch (err) {
    worker?.terminate();
    worker = null;
    engine = null;
    loading = null;
    setState({
      status: "failed",
      progress: null,
      text: "",
      error: err instanceof Error ? err.message : "WebLLM init failed",
    });
    return null;
  }
}

/** Start (or join) the model load. Safe to call from any page, any number of times. */
export function preloadEngine(force = false): Promise<MLCEngineInterface | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (force && state.status === "failed") loading = null;
  loading ??= load();
  return loading;
}

export function useWebLLM(): EngineState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}
