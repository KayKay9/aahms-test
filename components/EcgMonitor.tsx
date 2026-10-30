"use client";

import { useEffect, useRef } from "react";

/**
 * Bedside-monitor style Lead II ECG.
 *
 * Each beat is a sum of Gaussian P, Q, R, S and T waves (the standard synthetic
 * ECG model), with RR intervals that vary beat to beat by the crew member's HRV
 * plus respiratory sinus arrhythmia, slow baseline wander and a little noise.
 * The trace sweeps left to right at 25 mm/s over a 1 mm / 5 mm grid, with an
 * erase gap ahead of the write head like a real monitor. In arrhythmia mode the
 * rhythm becomes irregularly irregular with no P waves (AF-like).
 */

const SWEEP_SECONDS = 5; // 125 mm of paper at 25 mm/s
const GAP_PX = 14;

type Wave = { at: number; amp: number; width: number };

function beatWaves(rr: number, irregular: boolean): Wave[] {
  // Timings in seconds from beat onset, QT shortening with rate (Bazett-ish).
  const qtScale = Math.sqrt(Math.min(1.4, Math.max(0.45, rr)));
  const tPeak = 0.222 + 0.27 * qtScale;
  const waves: Wave[] = [
    { at: 0.204, amp: -0.08, width: 0.007 }, // Q
    { at: 0.222, amp: 1.1, width: 0.008 }, // R
    { at: 0.242, amp: -0.22, width: 0.009 }, // S
    // A real T wave rises slowly and falls faster, so build it from a broad and a narrow lobe.
    { at: tPeak - 0.035 * qtScale, amp: 0.14, width: 0.05 * qtScale },
    { at: tPeak, amp: 0.2, width: 0.03 * qtScale },
    { at: tPeak + 0.17 * qtScale, amp: 0.025, width: 0.03 * qtScale }, // U
  ];
  if (!irregular) waves.unshift({ at: 0.09, amp: 0.11, width: 0.022 }); // P
  return waves;
}

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function EcgMonitor({
  heartRate,
  hrv,
  irregular,
  className = "",
}: {
  heartRate: number;
  hrv: number;
  irregular: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const params = useRef({ heartRate, hrv, irregular });

  useEffect(() => {
    params.current = { heartRate, hrv, irregular };
  }, [heartRate, hrv, irregular]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    let trace = new Float32Array(0);
    let head = 0;
    let raf = 0;
    let last = performance.now();
    let clock = 0; // seconds of signal generated
    let beatStart = 0;
    let rr = 60 / Math.max(30, params.current.heartRate);
    let waves = beatWaves(rr, params.current.irregular);
    let fib = 0;
    let grid: HTMLCanvasElement | null = null;
    let gridPxPerMm = 1;

    const nextBeat = () => {
      const { heartRate: hr, hrv: v, irregular: irr } = params.current;
      const mean = 60 / Math.max(30, Math.min(200, hr));
      if (irr) {
        rr = mean * (0.55 + Math.random() * 0.9);
      } else {
        const rsa = 0.035 * mean * Math.sin((2 * Math.PI * clock) / 4.2);
        rr = mean + rsa + gauss() * (v / 1000) * 0.6;
        rr = Math.max(mean * 0.75, Math.min(mean * 1.25, rr));
      }
      waves = beatWaves(rr, irr);
    };

    const sample = (t: number) => {
      while (t - beatStart >= rr) {
        beatStart += rr;
        nextBeat();
      }
      const dt = t - beatStart;
      let mv = 0;
      for (const wv of waves) {
        const d = dt - wv.at;
        mv += wv.amp * Math.exp(-(d * d) / (2 * wv.width * wv.width));
      }
      // Breathing-linked baseline wander and light amplifier noise (monitor filters keep both small).
      mv += 0.035 * Math.sin(2 * Math.PI * 0.23 * t) + 0.015 * Math.sin(2 * Math.PI * 0.07 * t + 1);
      mv += gauss() * 0.006;
      if (params.current.irregular) {
        fib = fib * 0.85 + gauss() * 0.02;
        mv += fib + 0.04 * Math.sin(2 * Math.PI * 6.3 * t);
      }
      return mv;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const old = trace;
      trace = new Float32Array(w).fill(NaN);
      trace.set(old.subarray(0, Math.min(old.length, w)));
      head = Math.min(head, w - 1);
      grid = null; // repaint the static grid at the new size
    };

    // The grid never changes, so paint it once per size and blit it each frame.
    const paintGrid = () => {
      const c = document.createElement("canvas");
      c.width = w * dpr;
      c.height = h * dpr;
      const g = c.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pxPerMm = w / (SWEEP_SECONDS * 25);
      g.fillStyle = "#0a1120";
      g.fillRect(0, 0, w, h);
      g.lineWidth = 1;
      for (let i = 0, x = 0; x <= w; i++, x = i * pxPerMm) {
        g.strokeStyle = i % 5 === 0 ? "rgba(61,220,151,0.16)" : "rgba(61,220,151,0.055)";
        g.beginPath();
        g.moveTo(Math.round(x) + 0.5, 0);
        g.lineTo(Math.round(x) + 0.5, h);
        g.stroke();
      }
      for (let i = 0, y = h / 2; y <= h; i++, y = h / 2 + i * pxPerMm) {
        g.strokeStyle = i % 5 === 0 ? "rgba(61,220,151,0.16)" : "rgba(61,220,151,0.055)";
        for (const yy of i === 0 ? [y] : [y, h - y]) {
          g.beginPath();
          g.moveTo(0, Math.round(yy) + 0.5);
          g.lineTo(w, Math.round(yy) + 0.5);
          g.stroke();
        }
      }
      grid = c;
      gridPxPerMm = pxPerMm;
    };

    const drawGrid = () => {
      if (!grid) paintGrid();
      if (grid) ctx.drawImage(grid, 0, 0, w, h);
      return gridPxPerMm;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const pxPerSec = w / SWEEP_SECONDS;
      const steps = Math.max(1, Math.round(dt * pxPerSec));
      for (let i = 0; i < steps; i++) {
        clock += 1 / pxPerSec;
        head = (head + 1) % w;
        trace[head] = sample(clock);
        for (let g = 1; g <= GAP_PX; g++) trace[(head + g) % w] = NaN;
      }

      const pxPerMm = drawGrid();
      const mvToPx = pxPerMm * 10 * 0.85; // ~10 mm/mV, scaled to fit
      const color = params.current.irregular ? "#ff7a7a" : "#3ddc97";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let pen = false;
      for (let x = 0; x < w; x++) {
        const v = trace[x];
        if (Number.isNaN(v)) {
          pen = false;
          continue;
        }
        const y = h * 0.6 - v * mvToPx;
        if (pen) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();

      // Write head
      const hv = trace[head];
      if (!Number.isNaN(hv)) {
        const hy = h * 0.6 - hv * mvToPx;
        const glow = ctx.createRadialGradient(head, hy, 0, head, hy, 8);
        glow.addColorStop(0, "rgba(255,255,255,0.9)");
        glow.addColorStop(1, "rgba(61,220,151,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(head - 8, hy - 8, 16, 16);
      }

      // Lead and sweep settings in the corner, as bedside monitors show them
      ctx.fillStyle = "rgba(201,210,227,0.55)";
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillText("II   25 mm/s   10 mm/mV", 6, 12);

      raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(frame);
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full rounded-md ${className}`}
      role="img"
      aria-label={`ECG lead II, ${irregular ? "irregular rhythm" : "sinus rhythm"} at ${heartRate} beats per minute`}
    />
  );
}
