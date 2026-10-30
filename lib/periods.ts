"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Menstrual cycle log for crew on the female figure. On long missions many astronauts
 * suppress periods with continuous hormonal contraception; others menstruate normally,
 * so the log handles both. Stored per crew member in localStorage (offline-safe).
 */

export type Flow = "spotting" | "light" | "medium" | "heavy";

export const SYMPTOMS = ["Cramps", "Headache", "Bloating", "Fatigue", "Mood changes", "Back pain", "Nausea", "Dizziness"] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export type PeriodDay = {
  date: string; // YYYY-MM-DD
  flow: Flow;
  pain: number; // 0-10
  symptoms: Symptom[];
};

export type CycleLog = {
  suppressed: boolean;
  days: PeriodDay[];
};

const EMPTY: CycleLog = { suppressed: false, days: [] };
const KEY = "aahms_periods";
type Store = Record<string, CycleLog>;

const listeners = new Set<() => void>();
let cache: string | null = null;
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
};
const snapshot = () => (cache ??= read());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
const dayNum = (d: string) => Math.floor(Date.parse(d) / 86_400_000);

/** First day of each period: a logged day with no logged day before it within 2 days. */
export function periodStarts(log: CycleLog): string[] {
  const dates = [...new Set(log.days.map((d) => d.date))].sort();
  return dates.filter((d, i) => i === 0 || dayNum(d) - dayNum(dates[i - 1]) > 2);
}

export type CycleSummary = {
  lastStart: string | null;
  cycleDay: number | null;
  avgCycle: number | null;
  nextStart: string | null;
  currentLength: number; // consecutive bleeding days in the latest period
  alerts: { level: "YELLOW" | "RED"; text: string }[];
};

export function summarize(log: CycleLog, today = todayISO()): CycleSummary {
  const starts = periodStarts(log);
  const lastStart = starts[starts.length - 1] ?? null;
  const gaps = starts.slice(1).map((s, i) => dayNum(s) - dayNum(starts[i]));
  const avgCycle = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  const cycleDay = lastStart ? dayNum(today) - dayNum(lastStart) + 1 : null;
  const nextStart =
    lastStart && !log.suppressed ? new Date((dayNum(lastStart) + (avgCycle ?? 28)) * 86_400_000).toISOString().slice(0, 10) : null;
  const latest = lastStart ? log.days.filter((d) => d.date >= lastStart).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const currentLength = latest.length;

  const alerts: CycleSummary["alerts"] = [];
  const heavyDays = latest.filter((d) => d.flow === "heavy").length;
  const maxPain = Math.max(0, ...latest.map((d) => d.pain));
  if (log.suppressed && latest.length && cycleDay !== null && cycleDay <= 14)
    alerts.push({ level: "YELLOW", text: "Breakthrough bleeding while on hormone suppression. Usually harmless, but log it and tell the CMO, as the regimen may need adjusting." });
  if (currentLength > 7) alerts.push({ level: "RED", text: "Bleeding for more than 7 days. Tell the CMO; a blood count and iron check may be needed." });
  if (heavyDays >= 3) alerts.push({ level: "YELLOW", text: "Several heavy-flow days. Watch for tiredness, dizziness or breathlessness (signs of anaemia) and eat iron-rich food." });
  if (maxPain >= 7) alerts.push({ level: "RED", text: "Severe period pain (7/10 or more). Tell the CMO, especially if pain is one-sided, sudden or with fever." });
  if (latest.some((d) => d.symptoms.includes("Dizziness")) && heavyDays > 0)
    alerts.push({ level: "RED", text: "Dizziness with heavy bleeding can mean blood loss. Sit and restrain, check heart rate and SpO2, and call the CMO." });
  if (avgCycle !== null && (avgCycle < 21 || avgCycle > 35) && !log.suppressed)
    alerts.push({ level: "YELLOW", text: `Cycle length averages ${avgCycle} days (typical 21-35). Stress, sleep loss and spaceflight can shift cycles; mention it at the next medical conference.` });
  return { lastStart, cycleDay, avgCycle, nextStart, currentLength, alerts };
}

/** Self-care tips for the symptoms logged most recently. */
export function adviceFor(day: PeriodDay | undefined, nsaidAllergy: boolean): string[] {
  const tips = [
    "Drink to target (about 2-2.5 L a day); fluid shifts and dry cabin air make dehydration easier.",
    "Hygiene supplies are in the crew-care kit; used products go in sealed waste bags (no flushing in the waste system).",
  ];
  if (!day) return tips;
  if (day.symptoms.includes("Cramps") || day.symptoms.includes("Back pain") || day.pain >= 4)
    tips.unshift(
      `For cramps: a heat pack on the lower belly, light cycling to ease pain, and ${
        nsaidAllergy ? "acetaminophen (NOT ibuprofen: NSAID allergy on file)" : "ibuprofen with food or acetaminophen from the medical kit"
      }.`
    );
  if (day.flow === "heavy") tips.unshift("Heavy flow: change products often, eat iron-rich food, and log each day so the CMO can track blood loss.");
  if (day.symptoms.includes("Mood changes") || day.symptoms.includes("Fatigue"))
    tips.push("Mood or energy dip: protect sleep tonight and lighten the schedule if you can; it's fine to tell the crew.");
  if (day.symptoms.includes("Headache")) tips.push("Headache: check cabin CO₂ too, as both can stack up.");
  return tips;
}

export function getCycleLog(name: string): CycleLog {
  try {
    return (JSON.parse(snapshot()) as Store)[name] ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

export function useCycleLog(name: string) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "{}");
  const log: CycleLog = (JSON.parse(raw) as Store)[name] ?? EMPTY;

  const save = useCallback(
    (fn: (l: CycleLog) => CycleLog) => {
      const store = JSON.parse(read()) as Store;
      store[name] = fn(store[name] ?? EMPTY);
      try {
        localStorage.setItem(KEY, JSON.stringify(store));
      } catch {
        /* unavailable */
      }
      cache = null;
      listeners.forEach((l) => l());
    },
    [name]
  );

  const logDay = useCallback(
    (day: PeriodDay) => save((l) => ({ ...l, days: [...l.days.filter((d) => d.date !== day.date), day] })),
    [save]
  );
  const removeDay = useCallback((date: string) => save((l) => ({ ...l, days: l.days.filter((d) => d.date !== date) })), [save]);
  const setSuppressed = useCallback((suppressed: boolean) => save((l) => ({ ...l, suppressed })), [save]);

  return { log, logDay, removeDay, setSuppressed };
}
