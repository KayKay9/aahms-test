"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Daily exercise and sleep log for the crew routine panel. Sessions come either from
 * the wearable (accelerometer + HRV confirmed, "sensor") or are typed in by the crew
 * ("manual"). Stored in localStorage per day so it survives reloads and works offline.
 */

export type ExerciseType = "resistance" | "treadmill" | "cycle";
export type EntrySource = "sensor" | "manual";

export type ExerciseSession = {
  id: string;
  type: ExerciseType;
  minutes: number;
  /** Clock time the session started, "HH:MM". */
  at: string;
  source: EntrySource;
};

export type SleepEntry = {
  /** "HH:MM" bedtime (previous evening) and wake time. */
  bed: string;
  wake: string;
  source: EntrySource;
};

/** ISS-style daily prescription: about 2.5 h split across the three machines. */
export const EXERCISE_PLAN: Record<ExerciseType, { label: string; spoken: string; target: number }> = {
  resistance: { label: "Resistance (ARED)", spoken: "resistance machine", target: 60 },
  treadmill: { label: "Treadmill (T2)", spoken: "treadmill", target: 45 },
  cycle: { label: "Cycle (CEVIS)", spoken: "exercise bike", target: 45 },
};
export const EXERCISE_TARGET = 150;
export const SLEEP_TARGET = 8.5;

type DayLog = { exercise: ExerciseSession[]; sleep: SleepEntry };

const DEFAULT_DAY: DayLog = {
  exercise: [
    { id: "s1", type: "resistance", minutes: 52, at: "07:10", source: "sensor" },
    { id: "s2", type: "treadmill", minutes: 32, at: "13:05", source: "sensor" },
    { id: "s3", type: "cycle", minutes: 20, at: "16:40", source: "sensor" },
  ],
  sleep: { bed: "22:54", wake: "05:30", source: "sensor" },
};

const storageKey = () => `aahms_routine_${new Date().toISOString().slice(0, 10)}`;

/** Hours between bedtime and wake time, crossing midnight when needed. */
export function sleepDuration(entry: SleepEntry): number {
  const [bh, bm] = entry.bed.split(":").map(Number);
  const [wh, wm] = entry.wake.split(":").map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

export function formatHours(h: number): string {
  // Round total minutes first so 6.999 h shows as 7h 00m, not 6h 60m.
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

export function useRoutineLog() {
  const [day, setDay] = useState<DayLog>(DEFAULT_DAY);

  // Read after mount so the server render and first client render match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey());
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from storage
      if (raw) setDay(JSON.parse(raw));
    } catch {
      /* storage unavailable: keep defaults */
    }
  }, []);

  const save = useCallback((update: (d: DayLog) => DayLog) => {
    setDay((d) => {
      const next = update(d);
      try {
        localStorage.setItem(storageKey(), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const addExercise = useCallback(
    (type: ExerciseType, minutes: number, at: string) =>
      save((d) => ({
        ...d,
        exercise: [...d.exercise, { id: crypto.randomUUID(), type, minutes, at, source: "manual" as const }].sort((a, b) =>
          a.at.localeCompare(b.at)
        ),
      })),
    [save]
  );

  const removeExercise = useCallback(
    (id: string) => save((d) => ({ ...d, exercise: d.exercise.filter((s) => s.id !== id) })),
    [save]
  );

  const setSleep = useCallback(
    (bed: string, wake: string) => save((d) => ({ ...d, sleep: { bed, wake, source: "manual" } })),
    [save]
  );

  const exerciseMinutes = day.exercise.reduce((sum, s) => sum + s.minutes, 0);
  const byType = (Object.keys(EXERCISE_PLAN) as ExerciseType[]).map((type) => ({
    type,
    ...EXERCISE_PLAN[type],
    done: day.exercise.filter((s) => s.type === type).reduce((sum, s) => sum + s.minutes, 0),
  }));

  return {
    exercise: day.exercise,
    sleep: day.sleep,
    exerciseMinutes,
    sleepHours: sleepDuration(day.sleep),
    byType,
    addExercise,
    removeExercise,
    setSleep,
  };
}
