"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";
import { getLatestCheck, isToday } from "@/lib/selfCheck";

/**
 * Health missions: a short list of daily health tasks, with streaks and badges to make
 * the routine stick. Progress is derived from what the console already records (self-check,
 * exercise log, sleep log, PVT, body map) and a per-day history kept in this browser.
 */

export type TaskId = "selfcheck" | "exercise" | "sleep" | "pvt" | "bodymap";

export type Task = {
  id: TaskId;
  title: string;
  detail: string;
  points: number;
  tab: string;
  core: boolean;
  done: boolean;
};

export type Badge = { id: string; icon: string; name: string; how: string; earned: boolean };

const HISTORY_KEY = "aahms_missions_history";
const BODYMAP_KEY = "aahms_bodymap_seen";
const PVT_KEY = "aahms_pvt_summary";

type History = Record<string, Record<string, TaskId[]>>; // userId -> day -> done tasks

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Called by the body map when it is opened, for the "review your body map" task. */
export function markBodyMapSeen(userId: string) {
  try {
    const all = readJson<Record<string, string>>(BODYMAP_KEY, {});
    all[userId] = dayKey();
    localStorage.setItem(BODYMAP_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

const noopSubscribe = () => () => {};

export function useHealthMissions(userId: string) {
  const { exerciseMinutes, exerciseTarget, sleepHours, sleepTarget } = useMissionTelemetry();

  // Browser-only facts, read after hydration (server render shows nothing done).
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => {
      const check = getLatestCheck(userId);
      const pvt = readJson<{ at?: number } | null>(PVT_KEY, null);
      const seen = readJson<Record<string, string>>(BODYMAP_KEY, {})[userId];
      const history = readJson<History>(HISTORY_KEY, {})[userId] ?? {};
      return JSON.stringify({
        checkToday: !!check && isToday(check.at),
        everChecked: !!check,
        pvtToday: !!pvt?.at && isToday(pvt.at),
        bodyMapToday: seen === dayKey(),
        history,
      });
    },
    () => JSON.stringify({ checkToday: false, everChecked: false, pvtToday: false, bodyMapToday: false, history: {} })
  );
  const facts = useMemo(
    () =>
      JSON.parse(raw) as {
        checkToday: boolean;
        everChecked: boolean;
        pvtToday: boolean;
        bodyMapToday: boolean;
        history: Record<string, TaskId[]>;
      },
    [raw]
  );

  const tasks: Task[] = useMemo(
    () => [
      {
        id: "selfcheck",
        title: "Morning self-check",
        detail: "Blood pressure, blood sugar, temperature, mood and sleep",
        points: 30,
        tab: "check",
        core: true,
        done: facts.checkToday,
      },
      {
        id: "exercise",
        title: "Hit today's exercise plan",
        detail: `${exerciseMinutes} of ${exerciseTarget} min · protects bones and heart`,
        points: 30,
        tab: "habitat",
        core: true,
        done: exerciseMinutes >= exerciseTarget,
      },
      {
        id: "sleep",
        title: `Sleep ${Math.min(7, sleepTarget)} h or more`,
        detail: `Last night ${sleepHours.toFixed(1)} h`,
        points: 20,
        tab: "habitat",
        core: true,
        done: sleepHours >= Math.min(7, sleepTarget),
      },
      {
        id: "pvt",
        title: "Reaction-time test",
        detail: "3-minute PVT to check alertness",
        points: 20,
        tab: "pvt",
        core: true,
        done: facts.pvtToday,
      },
      {
        id: "bodymap",
        title: "Review your body map",
        detail: "Bonus: see what each reading means",
        points: 10,
        tab: "body",
        core: false,
        done: facts.bodyMapToday,
      },
    ],
    [facts, exerciseMinutes, exerciseTarget, sleepHours, sleepTarget]
  );

  // Record today's progress so streaks and badges build up over days.
  const doneIds = tasks.filter((t) => t.done).map((t) => t.id).join(",");
  useEffect(() => {
    try {
      const all = readJson<History>(HISTORY_KEY, {});
      const mine = all[userId] ?? {};
      mine[dayKey()] = doneIds ? (doneIds.split(",") as TaskId[]) : [];
      all[userId] = mine;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
    } catch {
      /* storage unavailable */
    }
  }, [userId, doneIds]);

  const history = useMemo(
    () => ({ ...facts.history, [dayKey()]: tasks.filter((t) => t.done).map((t) => t.id) }),
    [facts.history, tasks]
  );
  const coreIds = tasks.filter((t) => t.core).map((t) => t.id);
  const complete = (d: string) => coreIds.every((id) => history[d]?.includes(id));

  // Streak: consecutive complete days, counting today only once it is complete.
  let streak = 0;
  const cursor = new Date();
  if (!complete(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (complete(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const daysWith = (id: TaskId) => Object.values(history).filter((d) => d.includes(id)).length;
  const points =
    Object.values(history).reduce(
      (sum, d) => sum + d.reduce((s, id) => s + (tasks.find((t) => t.id === id)?.points ?? 0), 0),
      0
    ) + streak * 10;

  const badges: Badge[] = [
    { id: "first", icon: "🛰️", name: "First light", how: "Complete your first self-check", earned: facts.everChecked },
    { id: "streak3", icon: "🔥", name: "Ignition", how: "3-day streak of all core missions", earned: streak >= 3 },
    { id: "streak7", icon: "🚀", name: "Orbit", how: "7-day streak", earned: streak >= 7 },
    { id: "streak30", icon: "🪐", name: "Transit", how: "30-day streak", earned: streak >= 30 },
    { id: "bone", icon: "🦴", name: "Bone guardian", how: "Exercise plan done on 3 days", earned: daysWith("exercise") >= 3 },
    { id: "sleep", icon: "🌙", name: "Well rested", how: "7 h+ sleep on 3 days", earned: daysWith("sleep") >= 3 },
    { id: "sharp", icon: "⚡", name: "Sharp mind", how: "Reaction-time test on 3 days", earned: daysWith("pvt") >= 3 },
    { id: "sweep", icon: "🏅", name: "Full sweep", how: "All five missions in one day", earned: tasks.every((t) => t.done) },
  ];

  const remaining = tasks.filter((t) => t.core && !t.done).length;
  return { tasks, streak, points, badges, remaining };
}
