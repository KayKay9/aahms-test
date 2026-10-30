export type DemoScenarioId =
  | "nominal"
  | "arrhythmia"
  | "voice_stress"
  | "ppco2_pvt"
  | "solar_event";

export type DemoScenarioPreset = {
  id: DemoScenarioId;
  label: string;
  heartRateOffset: number;
  hrvOffset: number;
  radiation: number;
  ppCO2: number;
  voiceStress: boolean;
  arrhythmia: boolean;
  pvtSlowdown: boolean;
};

export const DEMO_SCENARIOS: DemoScenarioPreset[] = [
  {
    id: "nominal",
    label: "Nominal",
    heartRateOffset: 0,
    hrvOffset: 0,
    radiation: 0.075,
    ppCO2: 2.4,
    voiceStress: false,
    arrhythmia: false,
    pvtSlowdown: false,
  },
  {
    id: "arrhythmia",
    label: "Arrhythmia · 20m latency",
    heartRateOffset: 35,
    hrvOffset: -25,
    radiation: 0.075,
    ppCO2: 2.4,
    voiceStress: false,
    arrhythmia: true,
    pvtSlowdown: false,
  },
  {
    id: "voice_stress",
    label: "EV1 voice stress",
    heartRateOffset: 12,
    hrvOffset: -15,
    radiation: 0.075,
    ppCO2: 2.6,
    voiceStress: true,
    arrhythmia: false,
    pvtSlowdown: false,
  },
  {
    id: "ppco2_pvt",
    label: "ppCO₂ + PVT slowdown",
    heartRateOffset: 8,
    hrvOffset: -8,
    radiation: 0.075,
    ppCO2: 3.8,
    voiceStress: false,
    arrhythmia: false,
    pvtSlowdown: true,
  },
  {
    id: "solar_event",
    label: "Solar particle event",
    heartRateOffset: 5,
    hrvOffset: -5,
    radiation: 0.45,
    ppCO2: 2.4,
    voiceStress: false,
    arrhythmia: false,
    pvtSlowdown: false,
  },
];

export function getScenario(id: DemoScenarioId): DemoScenarioPreset {
  return DEMO_SCENARIOS.find((s) => s.id === id) ?? DEMO_SCENARIOS[0];
}
