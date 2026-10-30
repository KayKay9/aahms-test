"use client";

import { useEffect, useState } from "react";
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

/**
 * Live sensor readings around the scenario setpoints. ppCO₂ follows the scrubber's slow
 * adsorb/desorb cycle (and drops when the scrubber is boosted); the dosimeter reading has
 * counting noise, so it never sits perfectly still.
 */
function useLiveCabin(ppCO2: number, radiation: number, scrubberBoost: boolean) {
  const [t, setT] = useState(0);
  const [jitter, setJitter] = useState({ co2: 0, rad: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      setT((x) => x + 2);
      setJitter((j) => ({
        co2: j.co2 * 0.7 + (Math.random() - 0.5) * 0.06,
        rad: (Math.random() - 0.5) * 0.16,
      }));
    }, 2000);
    return () => clearInterval(id);
  }, []);
  const scrubberCycle = 0.18 * Math.sin((2 * Math.PI * t) / 144);
  return {
    ppCO2: Math.max(0.5, ppCO2 - (scrubberBoost ? 0.5 : 0) + scrubberCycle + jitter.co2),
    radiation: Math.max(0, radiation * (1 + jitter.rad)),
  };
}

export function CabinEnvironment() {
  const { ppCO2: co2Setpoint, radiation: radSetpoint, shieldingBoost, setShieldingBoost } =
    useMissionTelemetry();
  const { ppCO2, radiation } = useLiveCabin(co2Setpoint, radSetpoint, shieldingBoost);

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
          label="Radiation dose rate (GCR + solar)"
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
