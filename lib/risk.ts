export type RiskLevel = "GREEN" | "YELLOW" | "RED";

export type VitalSignals = {
  heartRate: number;
  hrv?: number | null;
  spo2: number;
  radiation?: number | null;
};

function signalRisk(
  value: number,
  green: [number, number],
  yellowLow: number,
  yellowHigh: number
): RiskLevel {
  if (value >= green[0] && value <= green[1]) return "GREEN";
  if (value < yellowLow || value > yellowHigh) return "RED";
  return "YELLOW";
}

export function assessRisk(vitals: VitalSignals): RiskLevel {
  const levels: RiskLevel[] = [];

  levels.push(signalRisk(vitals.heartRate, [55, 100], 45, 120));

  if (vitals.spo2 >= 95) levels.push("GREEN");
  else if (vitals.spo2 >= 90) levels.push("YELLOW");
  else levels.push("RED");

  const rad = vitals.radiation ?? 0;
  if (rad < 0.1) levels.push("GREEN");
  else if (rad <= 0.3) levels.push("YELLOW");
  else levels.push("RED");

  const hrv = vitals.hrv ?? 40;
  if (hrv > 30) levels.push("GREEN");
  else if (hrv >= 20) levels.push("YELLOW");
  else levels.push("RED");

  if (levels.includes("RED")) return "RED";
  if (levels.includes("YELLOW")) return "YELLOW";
  return "GREEN";
}

export function riskLabel(level: RiskLevel): string {
  switch (level) {
    case "GREEN":
      return "NOMINAL";
    case "YELLOW":
      return "CAUTION";
    case "RED":
      return "WARNING";
  }
}

export function riskColorClass(level: RiskLevel): string {
  switch (level) {
    case "GREEN":
      return "text-emerald-400 border-emerald-500/50 bg-emerald-500/10";
    case "YELLOW":
      return "text-amber-400 border-amber-500/50 bg-amber-500/10";
    case "RED":
      return "text-red-400 border-red-500/50 bg-red-500/10";
  }
}

export function worstRisk(levels: RiskLevel[]): RiskLevel {
  if (levels.includes("RED")) return "RED";
  if (levels.includes("YELLOW")) return "YELLOW";
  return "GREEN";
}
