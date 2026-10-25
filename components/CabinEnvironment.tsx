"use client";

import { Card } from "./ui/Card";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";

function LimitBar({
  label,
  value,
  unit,
  max,
  limit,
  limitLabel,
  barClass,
}: {
  label: string;
  value: string;
  unit: string;
  max: number;
  limit: number;
  limitLabel: string;
  barClass: string;
}) {
  const pct = Math.min(100, (Number(value) / max) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-mc-soft">{label}</span>
        <span className="font-mono text-2xl">
          {value}
          <span className="text-xs text-mc-label"> {unit}</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-mc-line">
        <div className={`h-1.5 rounded-full ${barClass}`} style={{ width: `${Math.max(1.5, pct)}%` }} />
        <div
          className="absolute -top-1 h-3.5 w-0.5 bg-mc-soft"
          style={{ left: `${(limit / max) * 100}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-mc-label">
        <span>0</span>
        <span>{limitLabel}</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function CabinEnvironment() {
  const { ppCO2, radiation, shieldingBoost, setShieldingBoost } =
    useMissionTelemetry();

  return (
    <Card title="Cabin environment & radiation" className="flex flex-col">
      <div className="flex flex-col gap-5">
        <LimitBar
          label="Module 3 ppCO₂"
          value={ppCO2.toFixed(1)}
          unit="mmHg"
          max={8}
          limit={4}
          limitLabel="FLIGHT RULE 4.0"
          barClass={ppCO2 > 4 ? "bg-mc-red" : ppCO2 > 3.5 ? "bg-mc-amber" : "bg-mc-green"}
        />
        <LimitBar
          label="Solar radiation dose rate"
          value={radiation.toFixed(3)}
          unit="mSv/hr"
          max={3}
          limit={1}
          limitLabel="SHELTER 1.0"
          barClass={radiation > 1 ? "bg-mc-red" : radiation > 0.1 ? "bg-mc-amber" : "bg-mc-green"}
        />
        <label className="flex items-center justify-between gap-3 rounded-md border border-mc-line bg-mc-inset px-3.5 py-3 text-sm">
          <span>Shielding / Air scrubber boost</span>
          <input
            type="checkbox"
            role="switch"
            checked={shieldingBoost}
            onChange={(e) => setShieldingBoost(e.target.checked)}
            className="h-[22px] w-10 accent-mc-select"
          />
        </label>
      </div>
    </Card>
  );
}
