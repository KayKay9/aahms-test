import type { RiskLevel } from "@/lib/risk";

/**
 * Daily Self-Check: the indicators the crew measures themselves each morning, with
 * how-to steps, why each matters in spaceflight, and the ranges used to colour the
 * result. Ranges are demo guidance modelled on common clinical cut-offs and NASA HRP
 * evidence summaries, not medical advice.
 */

export type Mood = 1 | 2 | 3 | 4 | 5;

export type SelfCheckValues = {
  systolic: number | null;
  diastolic: number | null;
  glucose: number | null; // mg/dL
  temperature: number | null; // °C
  mood: Mood | null;
  moodNote: string;
  sleepHours: number | null;
  fasting: boolean;
};

export type ItemResult = {
  id: StepId;
  label: string;
  display: string;
  level: RiskLevel;
  advice: string;
};

export type StepId = "bp" | "glucose" | "temperature" | "mood" | "sleep";

export type StepInfo = {
  id: StepId;
  title: string;
  unit: string;
  howTo: string[];
  whySpace: string;
  normal: string;
  hazard: string;
};

export const STEPS: StepInfo[] = [
  {
    id: "bp",
    title: "Blood pressure",
    unit: "mmHg",
    howTo: [
      "Sit strapped in, feet on the floor rail, and rest 5 minutes without talking.",
      "Put the cuff on your bare left upper arm, at heart level, tube over the inner elbow.",
      "Press start and stay still. Enter the top (systolic) and bottom (diastolic) numbers.",
    ],
    whySpace:
      "Without gravity, blood and fluid shift toward the head. Blood pressure and heart workload change in the first weeks, and stress, radiation and inactivity raise long-term cardiovascular risk.",
    normal: "Below 130 / 85 mmHg",
    hazard: "Gravity · Hostile environment",
  },
  {
    id: "glucose",
    title: "Blood sugar",
    unit: "mg/dL",
    howTo: [
      "Wash and dry your hands. Wipe a fingertip with an alcohol pad.",
      "Insert a test strip into the meter, prick the side of the fingertip with the lancet.",
      "Touch the drop to the strip and read the number. Note if you have eaten in the last 8 hours.",
    ],
    whySpace:
      "Spaceflight reduces insulin sensitivity: muscles use less sugar when unloaded, and stress hormones and poor sleep add to it. High fasting sugar is an early sign of metabolic change.",
    normal: "70–99 mg/dL fasting · below 140 after meals",
    hazard: "Gravity · Hostile environment",
  },
  {
    id: "temperature",
    title: "Body temperature",
    unit: "°C",
    howTo: [
      "Wait 15 minutes after exercise, a hot drink or a meal.",
      "Place the thermometer under your tongue, toward the back, and close your lips.",
      "Wait for the beep and enter the reading.",
    ],
    whySpace:
      "Core body temperature runs about 1 °C higher in space, and exercise heats you more because sweat doesn't evaporate. The immune system also weakens in flight, so a fever matters sooner.",
    normal: "36.1–37.5 °C",
    hazard: "Hostile environment · Isolation",
  },
  {
    id: "mood",
    title: "Mood",
    unit: "",
    howTo: [
      "Take one slow breath and think about the last 24 hours as a whole.",
      "Pick the face that matches how you feel. There is no wrong answer.",
      "Optionally add a word or two. Only you and the CMO can see it.",
    ],
    whySpace:
      "Isolation, confinement, a 20-minute delay to home and a heavy workload wear on mood. Tracking it daily catches a downward trend early, before it affects sleep, teamwork or safety.",
    normal: "3 (OK) or better",
    hazard: "Isolation · Distance",
  },
  {
    id: "sleep",
    title: "Sleep",
    unit: "hours",
    howTo: [
      "Check the hours from your sleep log (pre-filled), or enter them yourself.",
      "Count actual sleep, not time in the sleeping bag.",
    ],
    whySpace:
      "Light-dark cycles, noise and stress cut sleep in flight to about 6 hours on average. Sleep debt slows reaction time and raises error risk during critical tasks.",
    normal: "7 hours or more",
    hazard: "Isolation · Hostile environment",
  },
];

export const MOODS: { value: Mood; face: string; label: string }[] = [
  { value: 1, face: "😞", label: "Very low" },
  { value: 2, face: "🙁", label: "Low" },
  { value: 3, face: "😐", label: "OK" },
  { value: 4, face: "🙂", label: "Good" },
  { value: 5, face: "😄", label: "Great" },
];

export function assessBp(sys: number, dia: number): Omit<ItemResult, "id" | "label" | "display"> {
  if (sys >= 160 || dia >= 100 || sys < 85)
    return {
      level: "RED",
      advice:
        sys < 85
          ? "Low blood pressure. Lie down, drink 500 mL of fluid with salt tablets, and recheck in 15 minutes. Call the CMO if you feel faint."
          : "Very high. Rest 10 minutes and recheck. If still this high, or with headache, chest pain or vision change, call the CMO now.",
    };
  if (sys >= 130 || dia >= 85 || sys < 95)
    return {
      level: "YELLOW",
      advice:
        sys < 95
          ? "On the low side. Hydrate and stand up slowly; recheck tomorrow."
          : "Above target. Recheck after 5 minutes of rest. Cut salty snacks, keep exercise on plan, and recheck tomorrow.",
    };
  return { level: "GREEN", advice: "In range. Keep up hydration and daily exercise." };
}

export function assessGlucose(g: number, fasting: boolean): Omit<ItemResult, "id" | "label" | "display"> {
  if (g < 70)
    return {
      level: g < 54 ? "RED" : "YELLOW",
      advice:
        "Low. Take 15 g of fast sugar (juice pouch or glucose tabs), wait 15 minutes and recheck. Tell the CMO if it stays under 70 or you feel shaky or confused.",
    };
  const high = fasting ? [100, 126] : [140, 200];
  if (g >= high[1])
    return {
      level: "RED",
      advice: "High. Drink water, recheck in 2 hours, and report to the CMO. Note recent meals and medicines.",
    };
  if (g >= high[0])
    return {
      level: "YELLOW",
      advice: "Slightly high. Keep resistance exercise on plan (muscle use lowers sugar) and recheck tomorrow fasting.",
    };
  return { level: "GREEN", advice: "In range." };
}

export function assessTemperature(t: number): Omit<ItemResult, "id" | "label" | "display"> {
  if (t >= 38.5 || t < 35)
    return {
      level: "RED",
      advice:
        t < 35
          ? "Too low. Recheck the reading, warm up with layers and a warm drink, and call the CMO if it stays below 35 °C."
          : "Fever. Rest, hydrate, take paracetamol if not allergic, isolate from crew if possible and call the CMO.",
    };
  if (t >= 37.6 || t < 36)
    return {
      level: "YELLOW",
      advice:
        t < 36
          ? "A bit low. Recheck after 15 minutes."
          : "Slightly raised. Normal right after exercise in space; recheck after 30 minutes of rest.",
    };
  return { level: "GREEN", advice: "In range." };
}

export function assessMood(m: Mood): Omit<ItemResult, "id" | "label" | "display"> {
  if (m === 1)
    return {
      level: "RED",
      advice:
        "Thank you for being honest. Talk to the CMO today, and book a private conference with the ground psychologist. You are not alone out here.",
    };
  if (m === 2)
    return {
      level: "YELLOW",
      advice:
        "Plan something restorative today: a call or video from home, Earth-gazing, music, or a meal with the crew. Check in again tomorrow.",
    };
  return { level: "GREEN", advice: "Good. Keep protecting off-duty time." };
}

export function assessSleep(h: number): Omit<ItemResult, "id" | "label" | "display"> {
  if (h < 5)
    return {
      level: "RED",
      advice:
        "Severe sleep debt. Avoid EVA and critical tasks today if possible, take a 20-minute nap, and talk to the CMO about tonight's sleep plan.",
    };
  if (h < 7)
    return {
      level: "YELLOW",
      advice: "Short sleep. No caffeine after midday, dim the lights 1 hour before bed, and use eye mask and earplugs.",
    };
  return { level: "GREEN", advice: "Well rested." };
}

export function assessAll(v: SelfCheckValues): ItemResult[] {
  const out: ItemResult[] = [];
  if (v.systolic != null && v.diastolic != null)
    out.push({ id: "bp", label: "Blood pressure", display: `${v.systolic}/${v.diastolic} mmHg`, ...assessBp(v.systolic, v.diastolic) });
  if (v.glucose != null)
    out.push({
      id: "glucose",
      label: "Blood sugar",
      display: `${v.glucose} mg/dL${v.fasting ? " fasting" : ""}`,
      ...assessGlucose(v.glucose, v.fasting),
    });
  if (v.temperature != null)
    out.push({ id: "temperature", label: "Temperature", display: `${v.temperature.toFixed(1)} °C`, ...assessTemperature(v.temperature) });
  if (v.mood != null)
    out.push({
      id: "mood",
      label: "Mood",
      display: `${MOODS[v.mood - 1].face} ${MOODS[v.mood - 1].label}`,
      ...assessMood(v.mood),
    });
  if (v.sleepHours != null)
    out.push({ id: "sleep", label: "Sleep", display: `${v.sleepHours.toFixed(1)} h`, ...assessSleep(v.sleepHours) });
  return out;
}

export function overallLevel(items: ItemResult[]): RiskLevel {
  if (items.some((i) => i.level === "RED")) return "RED";
  if (items.some((i) => i.level === "YELLOW")) return "YELLOW";
  return "GREEN";
}

/** Live colour while typing, so the astronaut sees the meaning immediately. */
export function stepLevel(id: StepId, v: SelfCheckValues): RiskLevel | null {
  return assessAll(v).find((i) => i.id === id)?.level ?? null;
}

// --- Persistence: the latest check per user is cached for the co-pilot prompt.

const KEY = "aahms_selfcheck_latest";

export type StoredCheck = { userId: string; at: number; items: ItemResult[] };

export function saveLatestCheck(check: StoredCheck) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, StoredCheck>;
    all[check.userId] = check;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function getLatestCheck(userId: string): StoredCheck | null {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, StoredCheck>;
    return all[userId] ?? null;
  } catch {
    return null;
  }
}

export function isToday(ts: number) {
  return new Date(ts).toDateString() === new Date().toDateString();
}

/** One line for the co-pilot prompt. */
export function describeCheck(check: StoredCheck | null): string {
  if (!check) return "Daily self-check: not done yet.";
  const when = isToday(check.at) ? "today" : new Date(check.at).toLocaleDateString();
  return `Daily self-check (${when}): ${check.items
    .map((i) => `${i.label} ${i.display}${i.level === "GREEN" ? " (normal)" : i.level === "YELLOW" ? " (watch)" : " (ALERT)"}`)
    .join(", ")}.`;
}
