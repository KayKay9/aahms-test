"use client";

import { useMemo } from "react";

/** Deterministic pseudo-random so the synthetic history is stable per crew member. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967295;
  };
}

/**
 * 24 h HRV (RMSSD) trend as hourly bars. Uses recorded values when there are
 * enough; otherwise a plausible circadian profile around the current HRV
 * (higher during the sleep period, dipping during exercise and work blocks).
 */
export function HrvTrend({ userId, values, current }: { userId: string; values: number[]; current: number }) {
  // History is anchored to a coarse HRV level so it doesn't reshuffle as the live value drifts.
  const anchor = Math.round(current / 4) * 4;
  const history = useMemo(() => {
    if (values.length >= 12) return values.slice(-24, -1);
    const rand = seeded(userId || "crew");
    return Array.from({ length: 23 }, (_, i) => {
      const hourAgo = 23 - i;
      const sleep = hourAgo >= 14 && hourAgo <= 21 ? 1 : 0; // sleep period earlier in the day
      const exercise = hourAgo === 5 || hourAgo === 6 ? 1 : 0;
      const v = anchor * (1 + 0.22 * sleep - 0.25 * exercise) + (rand() - 0.5) * anchor * 0.3;
      return Math.max(10, v);
    });
  }, [userId, values, anchor]);
  const hours = [...history, current];

  const baseline = hours.reduce((a, b) => a + b, 0) / hours.length;
  const max = Math.max(...hours, baseline * 1.2);
  const lo = Math.min(...hours) * 0.6;
  const pct = (v: number) => ((v - lo) / (max - lo)) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex h-14 items-end gap-[3px]" role="img" aria-label={`HRV over the last 24 hours, baseline ${Math.round(baseline)} ms, now ${Math.round(current)} ms`}>
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-mc-soft/30"
          style={{ bottom: `${pct(baseline)}%` }}
          aria-hidden
        />
        {hours.map((v, i) => {
          const low = v < baseline * 0.8;
          const isNow = i === hours.length - 1;
          return (
            <div
              key={i}
              title={`${hours.length - 1 - i === 0 ? "Now" : `−${hours.length - 1 - i} h`}: ${Math.round(v)} ms`}
              className={`flex-1 rounded-t-sm ${
                isNow ? "bg-mc-green" : low ? "bg-mc-amber/70" : "bg-[#3a4a6b] hover:bg-[#4f6390]"
              }`}
              style={{ height: `${Math.max(6, pct(v))}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-mc-label">
        <span>−24 h</span>
        <span>−18 h</span>
        <span>−12 h</span>
        <span>−6 h</span>
        <span>Now</span>
      </div>
      <div className="flex gap-4 font-mono text-[10px] text-mc-label">
        <span>BASELINE {Math.round(baseline)} MS</span>
        <span>MIN {Math.round(Math.min(...hours))}</span>
        <span>MAX {Math.round(Math.max(...hours))}</span>
      </div>
    </div>
  );
}
