"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type DemoScenarioId,
  getScenario,
  type DemoScenarioPreset,
} from "@/lib/demoScenarios";

export type MissionTelemetryState = {
  scenario: DemoScenarioPreset;
  ppCO2: number;
  radiation: number;
  shieldingBoost: boolean;
  exerciseMinutes: number;
  exerciseTarget: number;
  sleepHours: number;
  sleepTarget: number;
  voiceStress: boolean;
  arrhythmia: boolean;
  pvtSlowdown: boolean;
  simulationEnabled: boolean;
};

type MissionTelemetryContextValue = MissionTelemetryState & {
  setScenario: (id: DemoScenarioId) => void;
  setShieldingBoost: (v: boolean) => void;
  setSimulationEnabled: (v: boolean) => void;
  setRadiation: (v: number) => void;
};

const MissionTelemetryContext =
  createContext<MissionTelemetryContextValue | null>(null);

export function MissionTelemetryProvider({ children }: { children: ReactNode }) {
  const [scenarioId, setScenarioId] = useState<DemoScenarioId>("nominal");
  const [shieldingBoost, setShieldingBoost] = useState(false);
  const [simulationEnabled, setSimulationEnabled] = useState(true);

  const scenario = getScenario(scenarioId);

  const setScenario = useCallback((id: DemoScenarioId) => {
    setScenarioId(id);
  }, []);

  const value = useMemo<MissionTelemetryContextValue>(() => {
    const rad =
      shieldingBoost && scenario.radiation > 0.1
        ? scenario.radiation * 0.35
        : scenario.radiation;
    return {
      scenario,
      ppCO2: scenario.ppCO2,
      radiation: rad,
      shieldingBoost,
      exerciseMinutes: 101,
      exerciseTarget: 120,
      sleepHours: 6.1,
      sleepTarget: 8,
      voiceStress: scenario.voiceStress,
      arrhythmia: scenario.arrhythmia,
      pvtSlowdown: scenario.pvtSlowdown,
      simulationEnabled,
      setScenario,
      setShieldingBoost,
      setSimulationEnabled,
      setRadiation: () => {},
    };
  }, [scenario, shieldingBoost, simulationEnabled, setScenario]);

  return (
    <MissionTelemetryContext.Provider value={value}>
      {children}
    </MissionTelemetryContext.Provider>
  );
}

export function useMissionTelemetry() {
  const ctx = useContext(MissionTelemetryContext);
  if (!ctx) {
    throw new Error("useMissionTelemetry must be used within provider");
  }
  return ctx;
}
