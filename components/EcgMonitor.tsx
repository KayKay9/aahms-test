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
  const waves: Wave[] = [
    { at: 0.2, amp: -0.12, width: 0.009 }, // Q
    { at: 0.222, amp: 1.25, width: 0.0095 }, // R
    { at: 0.245, amp: -0.3, width: 0.011 }, // S
    { at: 0.222 + 0.25 * qtScale, amp: 0.32, width: 0.05 * qtScale }, // T
  ];
  if (!irregular) waves.unshift({ at: 0.1, amp: 0.13, width: 0.026 }); // P
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
      mv += 0.06 * Math.sin(2 * Math.PI * 0.23 * t) + 0.025 * Math.sin(2 * Math.PI * 0.07 * t + 1);
      mv += gauss() * 0.012;
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
    };

    const drawGrid = () => {
      const pxPerMm = w / (SWEEP_SECONDS * 25);
      ctx.fillStyle = "#0a1120";
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (let i = 0, x = 0; x <= w; i++, x = i * pxPerMm) {
        ctx.strokeStyle = i % 5 === 0 ? "rgba(61,220,151,0.16)" : "rgba(61,220,151,0.055)";
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
        ctx.stroke();
      }
      for (let i = 0, y = h / 2; y <= h; i++, y = h / 2 + i * pxPerMm) {
        ctx.strokeStyle = i % 5 === 0 ? "rgba(61,220,151,0.16)" : "rgba(61,220,151,0.055)";
        for (const yy of i === 0 ? [y] : [y, h - y]) {
          ctx.beginPath();
          ctx.moveTo(0, Math.round(yy) + 0.5);
          ctx.lineTo(w, Math.round(yy) + 0.5);
          ctx.stroke();
        }
      }
      return pxPerMm;
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
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
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
      ctx.shadowBlur = 0;

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

      // Calibration pulse (1 mV, 200 ms), as printed on real strips
      ctx.strokeStyle = "rgba(201,210,227,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const base = h * 0.6;
      ctx.moveTo(4, base);
      ctx.lineTo(4, base - pxPerMm * 10 * 0.85);
      ctx.lineTo(4 + pxPerMm * 5, base - pxPerMm * 10 * 0.85);
      ctx.lineTo(4 + pxPerMm * 5, base);
      ctx.stroke();

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
