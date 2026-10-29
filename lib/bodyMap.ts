import type { RiskLevel } from "@/lib/risk";
import type { StoredCheck } from "@/lib/selfCheck";

/**
 * Body-map assessment: turns the readings the console already has (vitals, cabin,
 * routine, PVT, the daily self-check) into a status per body system, with what that
 * system does, how spaceflight affects it, and what to do now. Demo guidance written
 * from NASA Human Research Program risk summaries, not medical advice.
 */

export type RegionId = "brain" | "eyes" | "heart" | "lungs" | "blood" | "musculoskeletal";

export type Reading = { label: string; value: string; level: RiskLevel | null };

export type RegionStatus = {
  id: RegionId;
  name: string;
  level: RiskLevel;
  readings: Reading[];
  role: string;
  space: string;
  hazards: string;
  actions: string[];
};

export type BodyInputs = {
  heartRate: number;
  hrv: number;
  spo2: number;
  doseRate: number; // mSv/h
  arrhythmia: boolean;
  ppCO2: number;
  sleepHours: number;
  sleepTarget: number;
  exerciseMinutes: number;
  exerciseTarget: number;
  voiceStress: boolean;
  pvt: { mean: number; lapses: number } | null;
  check: StoredCheck | null;
  missionDay: number;
};

const worst = (levels: (RiskLevel | null)[]): RiskLevel =>
  levels.includes("RED") ? "RED" : levels.includes("YELLOW") ? "YELLOW" : "GREEN";

const fromCheck = (check: StoredCheck | null, id: string) => check?.items.find((i) => i.id === id) ?? null;

function band(v: number, green: [number, number], red: [number, number]): RiskLevel {
  if (v >= green[0] && v <= green[1]) return "GREEN";
  if (v < red[0] || v > red[1]) return "RED";
  return "YELLOW";
}

export function assessBody(x: BodyInputs): RegionStatus[] {
  const bp = fromCheck(x.check, "bp");
  const glucose = fromCheck(x.check, "glucose");
  const temp = fromCheck(x.check, "temperature");
  const mood = fromCheck(x.check, "mood");
  const notDone = "not done today";

  // --- Brain: mood, alertness, sleep, CO2 headaches
  const pvtLevel: RiskLevel | null = x.pvt
    ? x.pvt.mean > 450 || x.pvt.lapses >= 5
      ? "RED"
      : x.pvt.mean > 350 || x.pvt.lapses >= 2
        ? "YELLOW"
        : "GREEN"
    : null;
  const sleepLevel: RiskLevel = x.sleepHours < 5 ? "RED" : x.sleepHours < 7 ? "YELLOW" : "GREEN";
  const co2Level: RiskLevel = x.ppCO2 > 4 ? "RED" : x.ppCO2 > 3 ? "YELLOW" : "GREEN";
  const brainReadings: Reading[] = [
    { label: "Mood (self-check)", value: mood?.display ?? notDone, level: mood?.level ?? null },
    { label: "Sleep last night", value: `${x.sleepHours.toFixed(1)} h of ${x.sleepTarget} h`, level: sleepLevel },
    {
      label: "Reaction time (PVT)",
      value: x.pvt ? `${Math.round(x.pvt.mean)} ms · ${x.pvt.lapses} lapses` : "no test yet",
      level: pvtLevel,
    },
    { label: "Voice stress", value: x.voiceStress ? "elevated" : "normal", level: x.voiceStress ? "YELLOW" : "GREEN" },
    { label: "Cabin CO₂", value: `${x.ppCO2.toFixed(1)} mmHg`, level: co2Level },
  ];
  const brainLevel = worst(brainReadings.map((r) => r.level));
  const brainActions =
    brainLevel === "GREEN"
      ? ["Keep protecting off-duty time and a regular sleep window.", "Repeat the reaction-time test after long shifts."]
      : [
          ...(sleepLevel !== "GREEN" ? ["Protect tonight's sleep: lights dim 1 h before, eye mask and earplugs, no caffeine after midday."] : []),
          ...(pvtLevel && pvtLevel !== "GREEN" ? ["Slow reactions: avoid critical tasks (EVA, robotics) until a rested retest."] : []),
          ...(co2Level !== "GREEN" ? ["High CO₂ causes headaches and fog: boost the scrubber and work near a fan."] : []),
          ...(mood && mood.level !== "GREEN" ? ["Talk to the CMO today and book a private call with the ground psychologist."] : []),
          ...(x.voiceStress ? ["Take a 10-minute break with breathing exercises, then re-do the voice check-in."] : []),
        ];

  // --- Eyes: Spaceflight-Associated Neuro-ocular Syndrome (SANS)
  const sansLevel: RiskLevel = x.missionDay > 180 ? "YELLOW" : "GREEN";
  const eyes: RegionStatus = {
    id: "eyes",
    name: "Eyes",
    level: worst([sansLevel, bp?.level === "RED" ? "YELLOW" : null]),
    readings: [
      { label: "Mission day", value: `${x.missionDay}`, level: sansLevel },
      { label: "Blood pressure (head fluid)", value: bp?.display ?? notDone, level: bp?.level ?? null },
    ],
    role: "Focus near and far vision for screens, procedures and EVA work.",
    space:
      "Fluid shifts toward the head in microgravity press on the back of the eye and the optic nerve. About 70% of long-duration crew show some swelling or flattening (SANS), and near vision can blur, with the risk rising the longer the mission runs.",
    hazards: "Gravity",
    actions: [
      "Weekly: Amsler grid and near-vision chart check; report any new blur or wavy lines.",
      "Monthly: retinal imaging (OCT/fundoscopy) sent to the ground eye specialist.",
      "Use adjustable-focus glasses if near vision changes; keep salt intake low.",
    ],
  };

  // --- Heart: rate, rhythm, blood pressure
  const hrLevel = band(x.heartRate, [55, 100], [45, 120]);
  const heartReadings: Reading[] = [
    { label: "Heart rate", value: `${x.heartRate} bpm`, level: hrLevel },
    { label: "Rhythm", value: x.arrhythmia ? "irregular" : "normal sinus", level: x.arrhythmia ? "RED" : "GREEN" },
    { label: "HRV", value: `${Math.round(x.hrv)} ms`, level: x.hrv > 30 ? "GREEN" : x.hrv >= 20 ? "YELLOW" : "RED" },
    { label: "Blood pressure (self-check)", value: bp?.display ?? notDone, level: bp?.level ?? null },
  ];
  const heartLevel = worst(heartReadings.map((r) => r.level));

  // --- Lungs: oxygen and cabin air
  const spo2Level: RiskLevel = x.spo2 >= 95 ? "GREEN" : x.spo2 >= 90 ? "YELLOW" : "RED";
  const lungsLevel = worst([spo2Level, co2Level]);

  // --- Blood and immunity: sugar, fever, radiation
  const radLevel: RiskLevel = x.doseRate > 1 ? "RED" : x.doseRate > 0.1 ? "YELLOW" : "GREEN";
  const bloodReadings: Reading[] = [
    { label: "Blood sugar (self-check)", value: glucose?.display ?? notDone, level: glucose?.level ?? null },
    { label: "Temperature (self-check)", value: temp?.display ?? notDone, level: temp?.level ?? null },
    { label: "Radiation dose rate", value: `${x.doseRate.toFixed(3)} mSv/h`, level: radLevel },
  ];
  const bloodLevel = worst(bloodReadings.map((r) => r.level));

  // --- Bones and muscles: unloading vs. exercise countermeasure
  const adherence = Math.min(1, x.exerciseMinutes / x.exerciseTarget);
  const exLevel: RiskLevel = adherence >= 0.8 ? "GREEN" : adherence >= 0.4 ? "YELLOW" : "RED";
  // ~1-1.5% hip bone loss per month without exercise; resistance training cuts most of it.
  const months = x.missionDay / 30;
  const boneLoss = months * 1.25 * (1 - 0.7 * adherence);
  const boneLevel: RiskLevel = boneLoss > 6 ? "YELLOW" : "GREEN";

  return [
    {
      id: "brain",
      name: "Brain & mind",
      level: brainLevel,
      readings: brainReadings,
      role: "Thinking, memory, reaction time, mood and sleep regulation.",
      space:
        "Isolation, confinement and a 20-minute delay to home strain mood and teamwork. Short, broken sleep and high CO₂ slow reactions and cause headaches, and deep-space radiation may affect the central nervous system over time.",
      hazards: "Isolation · Distance · Hostile environment · Radiation",
      actions: brainActions,
    },
    eyes,
    {
      id: "heart",
      name: "Heart",
      level: heartLevel,
      readings: heartReadings,
      role: "Pumps blood and oxygen to every organ; adjusts rate and pressure to demand.",
      space:
        "Without gravity the heart works less and can shrink slightly; fluid shifts change blood pressure, and returning to gravity can cause fainting. Radiation and stress may raise long-term cardiovascular risk.",
      hazards: "Gravity · Radiation · Isolation",
      actions:
        heartLevel === "GREEN"
          ? ["Keep aerobic exercise (treadmill, cycle) on plan; it keeps the heart conditioned for landing."]
          : [
              ...(x.arrhythmia ? ["Irregular rhythm: stop activity, record a 12-lead ECG, and call the CMO now."] : []),
              ...(hrLevel !== "GREEN" ? ["Rest 10 minutes, hydrate and recheck heart rate."] : []),
              ...(bp && bp.level !== "GREEN" ? [bp.advice] : []),
              ...(x.hrv <= 30 ? ["Low HRV: lighten workload and protect the next sleep period."] : []),
            ],
    },
    {
      id: "lungs",
      name: "Lungs",
      level: lungsLevel,
      readings: [
        { label: "SpO₂", value: `${Math.round(x.spo2)} %`, level: spo2Level },
        { label: "Cabin CO₂", value: `${x.ppCO2.toFixed(1)} mmHg`, level: co2Level },
      ],
      role: "Take in oxygen and remove carbon dioxide.",
      space:
        "Lungs work well in microgravity, but the closed cabin air matters: CO₂ builds up in pockets without convection, and dust or toxic leaks have nowhere to go.",
      hazards: "Hostile environment",
      actions:
        lungsLevel === "GREEN"
          ? ["Nothing needed. Keep sleeping-quarters vents clear."]
          : [
              ...(spo2Level !== "GREEN" ? ["Re-seat the finger sensor and recheck; below 90% use supplemental oxygen and call the CMO."] : []),
              ...(co2Level !== "GREEN" ? ["Boost the CO₂ scrubber and move air with a portable fan."] : []),
            ],
    },
    {
      id: "blood",
      name: "Blood & immunity",
      level: bloodLevel,
      readings: bloodReadings,
      role: "Carries oxygen, sugar and immune cells; fights infection.",
      space:
        "The immune system weakens in flight and dormant viruses can reactivate. Muscles use less sugar when unloaded, so blood sugar control drifts. Radiation damages blood-forming cells and raises long-term cancer risk.",
      hazards: "Radiation · Gravity · Hostile environment",
      actions:
        bloodLevel === "GREEN"
          ? ["Keep resistance exercise and a balanced diet; repeat the self-check tomorrow."]
          : [
              ...(glucose && glucose.level !== "GREEN" ? [glucose.advice] : []),
              ...(temp && temp.level !== "GREEN" ? [temp.advice] : []),
              ...(radLevel === "RED"
                ? ["Solar particle event: go to the storm shelter now and stay until the all-clear."]
                : radLevel === "YELLOW"
                  ? ["Raised dose rate: limit time in lightly shielded modules and wear the dosimeter."]
                  : []),
            ],
    },
    {
      id: "musculoskeletal",
      name: "Bones & muscles",
      level: worst([exLevel, boneLevel]),
      readings: [
        { label: "Exercise today", value: `${x.exerciseMinutes} of ${x.exerciseTarget} min`, level: exLevel },
        { label: "Est. hip bone loss", value: `${boneLoss.toFixed(1)} % since launch`, level: boneLevel },
      ],
      role: "Support the body, protect organs and let you move and work.",
      space:
        "Without load, weight-bearing bones lose about 1–1.5% of their mass per month and leg and back muscles shrink. That raises fracture and kidney-stone risk, and makes walking hard on arrival.",
      hazards: "Gravity",
      actions:
        exLevel === "GREEN"
          ? ["On track. Keep resistance work (ARED) heavy; it's what protects bone."]
          : [
              `Finish today's plan: ${x.exerciseTarget - x.exerciseMinutes} more minutes, prioritising resistance (ARED).`,
              "Drink extra water to lower kidney-stone risk from bone calcium.",
            ],
    },
  ];
}

// --- NASA HRP's five hazards of human spaceflight ("RIDGE"), linked to body regions.

export type HazardId = "radiation" | "isolation" | "distance" | "gravity" | "environment";

export type HazardStatus = {
  id: HazardId;
  letter: string;
  name: string;
  level: RiskLevel;
  now: string;
  about: string;
  regions: RegionId[];
};

export function assessHazards(x: BodyInputs, regions: RegionStatus[], spaceMode: boolean): HazardStatus[] {
  const lvl = (id: RegionId) => regions.find((r) => r.id === id)!.level;
  const radLevel: RiskLevel = x.doseRate > 1 ? "RED" : x.doseRate > 0.1 ? "YELLOW" : "GREEN";
  const mood = x.check?.items.find((i) => i.id === "mood") ?? null;
  const isolationLevel = worst([mood?.level ?? null, x.voiceStress ? "YELLOW" : null, x.sleepHours < 5 ? "RED" : x.sleepHours < 7 ? "YELLOW" : "GREEN"]);
  const anyRed = regions.some((r) => r.level === "RED");
  const co2Level: RiskLevel = x.ppCO2 > 4 ? "RED" : x.ppCO2 > 3 ? "YELLOW" : "GREEN";
  const temp = x.check?.items.find((i) => i.id === "temperature") ?? null;

  return [
    {
      id: "radiation",
      letter: "R",
      name: "Radiation",
      level: radLevel,
      now: `${x.doseRate.toFixed(3)} mSv/h${radLevel === "RED" ? " · shelter now" : radLevel === "YELLOW" ? " · above background" : " · background"}`,
      about:
        "Outside Earth's magnetic field, galactic cosmic rays and solar particle events raise cancer risk and can damage the brain, heart and blood-forming cells.",
      regions: ["blood", "brain", "heart"],
    },
    {
      id: "isolation",
      letter: "I",
      name: "Isolation & confinement",
      level: isolationLevel,
      now: mood ? `mood ${mood.display}` : x.voiceStress ? "voice stress elevated" : "no mood check today",
      about:
        "Months in a small crew and a closed volume wear on mood, sleep and teamwork. Daily mood tracking and protected off-duty time catch problems early.",
      regions: ["brain"],
    },
    {
      id: "distance",
      letter: "D",
      name: "Distance from Earth",
      level: spaceMode && anyRed ? "YELLOW" : "GREEN",
      now: spaceMode ? "20 min one-way delay · no evacuation" : "link to Earth available",
      about:
        "Help is 20 minutes away by radio and months away in person. The crew must assess and treat themselves, which is why the on-board co-pilot and protocols exist.",
      regions: ["brain", "heart", "lungs", "blood", "eyes", "musculoskeletal"],
    },
    {
      id: "gravity",
      letter: "G",
      name: "Gravity fields",
      level: worst([lvl("musculoskeletal"), lvl("eyes"), lvl("heart") === "RED" ? "YELLOW" : null]),
      now: `day ${x.missionDay} in microgravity`,
      about:
        "Weightlessness unloads bones and muscles, shifts fluid toward the head (vision changes) and deconditions the heart. Switching between gravity levels causes dizziness and fainting.",
      regions: ["musculoskeletal", "eyes", "heart", "blood"],
    },
    {
      id: "environment",
      letter: "E",
      name: "Hostile closed environment",
      level: worst([co2Level, temp?.level ?? null]),
      now: `CO₂ ${x.ppCO2.toFixed(1)} mmHg${temp ? ` · temp ${temp.display}` : ""}`,
      about:
        "Recycled air, CO₂ build-up, noise, microbes and a weakened immune system make the cabin itself a health risk. Air quality and fever are watched daily.",
      regions: ["lungs", "brain", "blood"],
    },
  ];
}
