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
import { EXERCISE_TARGET, SLEEP_TARGET, useRoutineLog } from "@/lib/routineLog";

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
  routine: ReturnType<typeof useRoutineLog>;
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
  const routine = useRoutineLog();

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
      exerciseMinutes: routine.exerciseMinutes,
      exerciseTarget: EXERCISE_TARGET,
      sleepHours: routine.sleepHours,
      sleepTarget: SLEEP_TARGET,
      routine,
      voiceStress: scenario.voiceStress,
      arrhythmia: scenario.arrhythmia,
      pvtSlowdown: scenario.pvtSlowdown,
      simulationEnabled,
      setScenario,
      setShieldingBoost,
      setSimulationEnabled,
      setRadiation: () => {},
    };
  }, [scenario, shieldingBoost, simulationEnabled, setScenario, routine]);

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
