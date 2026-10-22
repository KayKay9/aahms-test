"use client";

import { Card } from "./ui/Card";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";

export function CabinEnvironment() {
  const { ppCO2, radiation, shieldingBoost, setShieldingBoost } =
    useMissionTelemetry();

  const ppPct = Math.min(100, (ppCO2 / 4) * 100);
  const radPct = Math.min(100, (radiation / 1) * 100);

  return (
    <Card title="Cabin environment & radiation">
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Module 3 ppCO₂</span>
            <span className="font-mono text-cyan-200">{ppCO2.toFixed(1)} mmHg</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-800">
            <div
              className={`h-full ${ppCO2 > 3.5 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${ppPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-600">Flight rule limit 4.0 mmHg</p>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Solar radiation dose rate</span>
            <span className="font-mono text-cyan-200">
              {radiation.toFixed(3)} mSv/hr
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-800">
            <div
              className={`h-full ${radiation > 0.1 ? "bg-red-500" : "bg-cyan-500"}`}
              style={{ width: `${radPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-600">Shelter limit 1.0 mSv/hr</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={shieldingBoost}
            onChange={(e) => setShieldingBoost(e.target.checked)}
            className="rounded border-cyan-800"
          />
          Shielding / air scrubber boost
        </label>
      </div>
    </Card>
  );
}
