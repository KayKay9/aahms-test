"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * External injuries (cuts, burns, sprains, eye debris...) reported on the body map.
 * Kept in localStorage per crew member so they work offline and survive reloads; the
 * co-pilot reads the same store. First-aid text follows standard first-aid practice,
 * adapted for a spacecraft (no gravity drainage, limited kit, ground is 20 min away).
 */

export type InjuryType = "cut" | "burn" | "bruise" | "sprain" | "eye" | "skin" | "other";

export type InjuryUpdate = {
  at: number;
  pain: number; // 0-10
  note: string;
  photo?: string; // small JPEG data URL
};

export type Injury = {
  id: string;
  type: InjuryType;
  /** Position on the figure, % of the figure box. */
  x: number;
  y: number;
  area: string;
  reportedAt: number;
  updates: InjuryUpdate[];
  healed: boolean;
};

export const INJURY_TYPES: Record<
  InjuryType,
  { label: string; icon: string; steps: string[]; escalate: string; keywords: string[] }
> = {
  cut: {
    label: "Cut or scrape",
    icon: "🩹",
    steps: [
      "Put on gloves. Press a clean gauze pad firmly on the wound for 10 minutes to stop bleeding.",
      "Rinse with sterile water or saline; capture floating droplets with gauze so they don't drift.",
      "Close small gaps with wound-closure strips, cover with a sterile dressing.",
      "Check daily for redness, warmth, swelling or pus, and change the dressing.",
    ],
    escalate: "Call the CMO if bleeding won't stop after 10 minutes of pressure, the cut is deep or gaping, or there are signs of infection.",
    keywords: ["cut", "scrape", "laceration", "bleeding", "wound", "slice", "graze", "abrasion"],
  },
  burn: {
    label: "Burn",
    icon: "🔥",
    steps: [
      "Remove the heat source and any rings or tight items near the area.",
      "Cool with cool (not ice-cold) water or a wet compress for 20 minutes.",
      "Cover loosely with a non-stick sterile dressing. Do not pop blisters.",
      "Give pain relief from the medical kit after checking allergies.",
    ],
    escalate: "Call the CMO for burns larger than the person's palm, on the face, hands, joints or groin, or any white/charred skin.",
    keywords: ["burn", "scald", "hot", "blister", "chemical"],
  },
  bruise: {
    label: "Bruise or bump",
    icon: "🟣",
    steps: [
      "Apply a cold pack wrapped in cloth for 15-20 minutes, several times a day for the first day.",
      "Rest the area and keep it supported.",
      "For a head bump, watch for headache, confusion, vomiting or unequal pupils over the next 24 hours.",
    ],
    escalate: "Call the CMO after any head injury with confusion, vomiting, drowsiness or unequal pupils, or if swelling keeps growing.",
    keywords: ["bruise", "bump", "hit", "knock", "hematoma", "swelling", "head injury", "banged"],
  },
  sprain: {
    label: "Sprain or possible fracture",
    icon: "🦴",
    steps: [
      "Stop using the limb. Immobilize it with a splint (SAM splint in the kit) in the position found.",
      "Cold pack wrapped in cloth for 15-20 minutes; keep the limb supported.",
      "Check fingers or toes beyond the injury for color, warmth and feeling.",
      "Bone loss in space makes fractures more likely after a fall or impact, so treat severe pain as a possible fracture.",
    ],
    escalate: "Call the CMO for deformity, inability to move or bear load, numbness or cold, pale fingers/toes beyond the injury.",
    keywords: ["sprain", "fracture", "broken", "twist", "wrist", "ankle", "joint", "dislocat", "bone"],
  },
  eye: {
    label: "Eye injury or debris",
    icon: "👁️",
    steps: [
      "Do not rub the eye. Floating debris is common in weightlessness.",
      "Flush with the eye-wash bottle or sterile saline for at least 15 minutes, eyelid held open.",
      "For chemicals, keep flushing and identify the substance.",
      "Cover lightly with an eye shield if pain continues.",
    ],
    escalate: "Call the CMO for any chemical exposure, object stuck in the eye, vision change, or pain lasting after flushing.",
    keywords: ["eye", "debris", "vision", "blurry", "particle", "scratch in eye"],
  },
  skin: {
    label: "Rash or skin irritation",
    icon: "🌡️",
    steps: [
      "Keep the area clean and dry; spacesuit pressure points and dry cabin air commonly cause irritation.",
      "Use moisturizer for dryness, or hydrocortisone cream for itchy rash.",
      "Take an antihistamine (loratadine) for itching after checking allergies.",
    ],
    escalate: "Call the CMO if the rash spreads fast, blisters, comes with fever, or with face/throat swelling (possible allergic reaction).",
    keywords: ["rash", "itch", "skin", "irritation", "hives", "dry skin", "chafing", "red skin"],
  },
  other: {
    label: "Other",
    icon: "❓",
    steps: ["Describe the problem in the note, keep the area clean and protected, and recheck in an hour."],
    escalate: "Call the CMO if pain is 7/10 or more, getting worse, or you are unsure.",
    keywords: [],
  },
};

/**
 * Body area for a tap on the front-view figure (the figure's left is the viewer's right).
 * Bands follow the figure's outline in BodyMap (viewBox 200 x 400, shown as % here).
 */
export function areaFor(x: number, y: number, sex: "male" | "female" = "male"): string {
  const side = x < 50 ? "Right" : "Left";
  const dx = Math.abs(x - 50); // distance from the midline
  // Private areas first: genitals sit between the legs below the groin crease.
  if (dx <= 5 && y >= 55 && y < 62) return "Genitals";
  if (sex === "female" && dx > 3 && dx <= 15 && y >= 25 && y < 32) return `${side} breast`;
  if (y < 8) return "Head";
  if (y < 15) return "Face";
  if (y < 19) return "Neck";
  if (dx > 18 && y < 61) {
    // arms hang outside the torso
    if (y < 25) return `${side} shoulder`;
    if (y < 39) return `${side} upper arm`;
    if (y < 43) return `${side} elbow`;
    if (y < 51) return `${side} forearm`;
    if (y < 54) return `${side} wrist`;
    return `${side} hand`;
  }
  if (y < 25) return dx > 12 ? `${side} shoulder` : "Chest";
  if (y < 37) return "Chest";
  if (y < 48) return "Abdomen";
  if (y < 57) return dx > 8 ? `${side} hip` : "Groin";
  if (y < 75) return `${side} thigh`;
  if (y < 81) return `${side} knee`;
  if (y < 95) return `${side} lower leg`;
  return `${side} foot`;
}

/**
 * Areas to pick from when a tap lands slightly off, with a marker position for each.
 * Back areas have no back view, so their markers sit on the matching front spot.
 */
export const BODY_AREAS: { name: string; x: number; y: number }[] = [
  { name: "Head", x: 50, y: 5 },
  { name: "Face", x: 50, y: 11 },
  { name: "Neck", x: 50, y: 16.5 },
  ...(["Right", "Left"] as const).flatMap((s) => {
    const m = (x: number) => (s === "Right" ? x : 100 - x);
    return [
      { name: `${s} shoulder`, x: m(30), y: 22 },
      { name: `${s} upper arm`, x: m(25), y: 32 },
      { name: `${s} elbow`, x: m(21), y: 41 },
      { name: `${s} forearm`, x: m(19), y: 47 },
      { name: `${s} wrist`, x: m(16), y: 52.5 },
      { name: `${s} hand`, x: m(16.5), y: 57 },
      { name: `${s} hip`, x: m(36), y: 52 },
      { name: `${s} thigh`, x: m(42), y: 66 },
      { name: `${s} knee`, x: m(43), y: 78 },
      { name: `${s} lower leg`, x: m(43), y: 88 },
      { name: `${s} foot`, x: m(43), y: 98 },
    ];
  }),
  { name: "Chest", x: 50, y: 30 },
  { name: "Abdomen", x: 50, y: 42 },
  { name: "Groin", x: 50, y: 54 },
  { name: "Genitals", x: 50, y: 58.5 },
  { name: "Right breast", x: 42.5, y: 28.5 },
  { name: "Left breast", x: 57.5, y: 28.5 },
  { name: "Upper back", x: 50, y: 26 },
  { name: "Lower back", x: 50, y: 46 },
];

/** Status color for a marker: red if new and painful, amber while healing, green once healed. */
export function injuryLevel(i: Injury): "RED" | "YELLOW" | "GREEN" {
  if (i.healed) return "GREEN";
  const pain = i.updates[i.updates.length - 1]?.pain ?? 0;
  return pain >= 7 ? "RED" : pain >= 1 ? "YELLOW" : "GREEN";
}

const KEY = "aahms_injuries";
type Store = Record<string, Injury[]>; // crew member name -> injuries

const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full or unavailable */
  }
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function snapshot() {
  cache ??= read();
  return cache;
}

export function getInjuries(name: string): Injury[] {
  try {
    return (JSON.parse(snapshot()) as Store)[name] ?? [];
  } catch {
    return [];
  }
}

export function useInjuries(name: string) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "{}");
  const all = (JSON.parse(raw) as Store)[name] ?? [];

  const mutate = useCallback(
    (fn: (list: Injury[]) => Injury[]) => {
      const store = JSON.parse(read()) as Store;
      store[name] = fn(store[name] ?? []);
      write(store);
    },
    [name]
  );

  const report = useCallback(
    (type: InjuryType, x: number, y: number, first: InjuryUpdate, area = areaFor(x, y)) => {
      const injury: Injury = { id: crypto.randomUUID(), type, x, y, area, reportedAt: first.at, updates: [first], healed: false };
      mutate((list) => [...list, injury]);
      return injury.id;
    },
    [mutate]
  );

  const addUpdate = useCallback(
    (id: string, update: InjuryUpdate) =>
      mutate((list) => list.map((i) => (i.id === id ? { ...i, updates: [...i.updates, update], healed: update.pain === 0 ? i.healed : false } : i))),
    [mutate]
  );

  const setHealed = useCallback(
    (id: string, healed: boolean) => mutate((list) => list.map((i) => (i.id === id ? { ...i, healed } : i))),
    [mutate]
  );

  const remove = useCallback((id: string) => mutate((list) => list.filter((i) => i.id !== id)), [mutate]);

  return { injuries: all, report, addUpdate, setHealed, remove };
}

/** Shrink a camera photo to a small JPEG so a handful fit in localStorage. */
export function compressPhoto(file: File, max = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
