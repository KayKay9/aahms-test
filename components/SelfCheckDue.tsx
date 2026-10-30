"use client";

import { useSyncExternalStore } from "react";
import { getLatestCheck, isToday } from "@/lib/selfCheck";

const noopSubscribe = () => () => {};

/** Morning prompt on the vitals tab until today's self-check is done. */
export function SelfCheckDue({ userId, onStart }: { userId: string; onStart: () => void }) {
  // Server render assumes "done" so nothing flashes; the real value applies after hydration.
  const done = useSyncExternalStore(
    noopSubscribe,
    () => {
      const c = getLatestCheck(userId);
      return !!c && isToday(c.at);
    },
    () => true
  );
  if (done) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-mc-select/50 bg-mc-select/10 px-5 py-3.5">
      <div>
        <p className="text-sm font-semibold">Morning self-check due</p>
        <p className="text-xs text-mc-muted">Blood pressure, blood sugar, temperature, mood and sleep · about 2 minutes</p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="min-h-10 rounded-md border border-mc-nasa-edge bg-mc-nasa px-4 text-sm font-semibold text-white"
      >
        Start now
      </button>
    </div>
  );
}
