"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./ui/Card";
import { useMissionTelemetry } from "@/components/MissionTelemetryProvider";

const PVT_STORAGE_KEY = "aahms_pvt_summary";
const BEST_KEY = "aahms_pvt_best";
const DURATIONS = [1, 3, 5] as const;
const LEVEL_SECONDS = 30;
const LAPSE_MS = 500;

/**
 * "Beacon Lock": the psychomotor vigilance test as a short arcade game. Green beacons
 * appear at random and shrink away; tap them fast to lock on. Red decoys test impulse
 * control and must be left alone. Speed builds a combo multiplier, levels get faster,
 * and the run ends with an alertness verdict based on the same reaction-time and
 * lapse measures a real PVT uses.
 */

type Beacon = {
  id: number;
  x: number; // 0-1 fraction of free space
  y: number;
  decoy: boolean;
  shownAt: number;
  life: number; // ms before it fades out
  size: number; // px
};

type Pop = { id: number; x: number; y: number; text: string; tone: "good" | "bad" | "info" };

type Stats = {
  score: number;
  combo: number;
  bestCombo: number;
  hits: number[]; // reaction times of successful locks (ms, slowdown-adjusted)
  missed: number; // beacons that faded before being tapped
  decoyHits: number;
  decoyAvoided: number;
  strays: number; // taps on empty space
};

const EMPTY: Stats = { score: 0, combo: 0, bestCombo: 0, hits: [], missed: 0, decoyHits: 0, decoyAvoided: 0, strays: 0 };

function levelFor(elapsedS: number) {
  return Math.floor(elapsedS / LEVEL_SECONDS) + 1;
}

/** Faster, smaller beacons and more decoys as the level rises. */
function beaconFor(level: number, focusMode: boolean, id: number): Beacon {
  return {
    id,
    x: Math.random(),
    y: Math.random(),
    decoy: focusMode && Math.random() < Math.min(0.3, 0.12 + level * 0.03),
    shownAt: performance.now(),
    life: Math.max(650, 1600 - (level - 1) * 180),
    size: Math.max(38, 70 - (level - 1) * 6),
  };
}

function verdict(mean: number, lapses: number, n: number) {
  if (n === 0) return { label: "No data", tone: "text-mc-muted", advice: "Lock at least a few beacons to get a reading." };
  if (mean < 350 && lapses <= 2)
    return { label: "Alert · mission ready", tone: "text-mc-green", advice: "Reaction times are in the normal range. Cleared for demanding tasks." };
  if (mean < 450 && lapses <= 5)
    return {
      label: "Mild fatigue",
      tone: "text-mc-amber",
      advice: "Slightly slow. Hydrate, check cabin CO₂, and avoid critical tasks until you retest after a break.",
    };
  return {
    label: "Fatigued · rest advised",
    tone: "text-mc-red",
    advice: "Slow responses and lapses point to fatigue or sleep debt. Rest before EVA, robotics or other critical work, then retest.",
  };
}

/** Tiny WebAudio blips: pitch rises with the combo, a low buzz for mistakes. */
function useBlips(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback(
    (kind: "hit" | "bad" | "level", combo = 0) => {
      if (!enabled) return;
      try {
        ctxRef.current ??= new AudioContext();
        const ctx = ctxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === "bad" ? "sawtooth" : "sine";
        osc.frequency.value = kind === "bad" ? 140 : kind === "level" ? 880 : 520 + Math.min(combo, 10) * 60;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "level" ? 0.35 : 0.15));
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch {
        /* audio unavailable */
      }
    },
    [enabled]
  );
}

export function PVTTest() {
  const { pvtSlowdown } = useMissionTelemetry();
  const [minutes, setMinutes] = useState<(typeof DURATIONS)[number]>(1);
  const [focusMode, setFocusMode] = useState(true);
  const [sound, setSound] = useState(true);
  const [phase, setPhase] = useState<"idle" | "countdown" | "running" | "done">("idle");
  const [count, setCount] = useState(3);
  const [beacon, setBeacon] = useState<Beacon | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [remaining, setRemaining] = useState(0);
  const [level, setLevel] = useState(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [best, setBest] = useState(0);
  // The live beacon, read by timers so expiry never double-counts a beacon already tapped.
  const beaconRef = useRef<Beacon | null>(null);
  const showBeacon = (b: Beacon | null) => {
    beaconRef.current = b;
    setBeacon(b);
  };

  const endAt = useRef(0);
  const startedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(1);
  const levelRef = useRef(1);
  const blip = useBlips(sound);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from storage
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      /* unavailable */
    }
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const pop = useCallback((b: Beacon, text: string, tone: Pop["tone"]) => {
    const id = nextId.current++;
    setPops((p) => [...p, { id, x: b.x, y: b.y, text, tone }]);
    later(() => setPops((p) => p.filter((q) => q.id !== id)), 800);
  }, []);

  const jolt = useCallback(() => {
    setShaking(true);
    later(() => setShaking(false), 300);
  }, []);

  // An expiring beacon queues the next one through this ref, since a callback can't name itself.
  const spawnRef = useRef<() => void>(() => {});

  // Each beacon gets a fresh random gap before it appears, like a real PVT's
  // unpredictable stimulus interval, then fades out on its own if not tapped.
  const spawn = useCallback(() => {
    later(() => {
      if (Date.now() >= endAt.current) return;
      const b = beaconFor(levelRef.current, focusMode, nextId.current++);
      showBeacon(b);
      later(() => {
        if (beaconRef.current?.id !== b.id) return;
        showBeacon(null);
        if (b.decoy) {
          setStats((s) => ({ ...s, decoyAvoided: s.decoyAvoided + 1, score: s.score + 10 }));
          pop(b, "+10 restraint", "info");
        } else {
          setStats((s) => ({ ...s, missed: s.missed + 1, combo: 0 }));
          pop(b, "MISSED", "bad");
          jolt();
          blip("bad");
        }
        spawnRef.current();
      }, b.life);
    }, 350 + Math.random() * 1150);
  }, [focusMode, pop, blip, jolt]);
  useEffect(() => {
    spawnRef.current = spawn;
  }, [spawn]);

  const start = () => {
    clearTimers();
    setStats(EMPTY);
    showBeacon(null);
    setPops([]);
    setLevel(1);
    levelRef.current = 1;
    setCount(3);
    setPhase("countdown");
    [2, 1].forEach((n, i) => later(() => setCount(n), (i + 1) * 700));
    later(() => {
      startedAt.current = Date.now();
      endAt.current = Date.now() + minutes * 60_000;
      setRemaining(minutes * 60);
      setPhase("running");
      spawn();
    }, 2100);
  };

  const finish = useCallback(() => {
    clearTimers();
    showBeacon(null);
    setPhase("done");
  }, []);

  const tapBeacon = (b: Beacon) => {
    if (beaconRef.current?.id !== b.id) return;
    showBeacon(null);
    if (b.decoy) {
      setStats((s) => ({ ...s, decoyHits: s.decoyHits + 1, combo: 0, score: Math.max(0, s.score - 50) }));
      pop(b, "−50 decoy!", "bad");
      jolt();
      blip("bad");
    } else {
      const raw = performance.now() - b.shownAt;
      const rt = pvtSlowdown ? raw * 1.35 + 80 : raw;
      // Taps re-render between each other, so the rendered stats are current here.
      const combo = rt <= LAPSE_MS ? stats.combo + 1 : 0;
      const mult = Math.min(5, 1 + Math.floor(combo / 3));
      const points = Math.max(10, Math.round((1000 - Math.min(rt, 900)) / 5)) * mult;
      pop(b, `+${points}${rt < 300 ? " FAST!" : ""}${mult > 1 ? ` x${mult}` : ""}`, "good");
      blip("hit", combo);
      setStats((s) => ({ ...s, hits: [...s.hits, rt], combo, bestCombo: Math.max(s.bestCombo, combo), score: s.score + points }));
    }
    spawn();
  };

  // Clock, level-ups and the end of the run.
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      const lv = levelFor((Date.now() - startedAt.current) / 1000);
      if (lv !== levelRef.current && left > 0) {
        levelRef.current = lv;
        setLevel(lv);
        setBanner(`LEVEL ${lv} · faster beacons`);
        blip("level");
        setTimeout(() => setBanner(null), 1400);
      }
      if (left === 0) finish();
    }, 250);
    return () => clearInterval(id);
  }, [phase, finish, blip]);

  const n = stats.hits.length;
  const mean = n ? stats.hits.reduce((a, b) => a + b, 0) / n : 0;
  const lapses = stats.hits.filter((t) => t > LAPSE_MS).length + stats.missed;
  const fastest = n ? Math.min(...stats.hits) : 0;
  const targets = n + stats.missed;
  const accuracy = targets ? Math.round((n / targets) * 100) : 0;
  const v = verdict(mean, lapses, n);

  // Save the result for the co-pilot, body map and daily missions, and track the best score.
  useEffect(() => {
    if (phase !== "done" || n === 0) return;
    try {
      localStorage.setItem(PVT_STORAGE_KEY, JSON.stringify({ mean, lapses, at: Date.now() }));
      if (stats.score > best) {
        localStorage.setItem(BEST_KEY, String(stats.score));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- record a new high score once per run
        setBest(stats.score);
      }
    } catch {
      /* unavailable */
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const mult = Math.min(5, 1 + Math.floor(stats.combo / 3));

  return (
    <Card
      title="Cognitive PVT · Beacon Lock"
      action={
        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          className="rounded border border-mc-line-strong px-2 py-1 font-mono text-[11px] text-mc-label hover:text-white"
        >
          {sound ? "🔊 sound on" : "🔇 sound off"}
        </button>
      }
    >
      <p className="mb-3 text-xs text-slate-400">
        Psychomotor vigilance test, a standard fatigue check on the ISS. Tap <span className="text-emerald-300">green beacons</span> as
        fast as you can{focusMode && <>; leave <span className="text-red-300">red decoys</span> alone</>}.
        {pvtSlowdown && <span className="ml-2 text-amber-400">ppCO₂ slowdown active</span>}
      </p>

      {phase !== "running" && phase !== "countdown" && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Duration</span>
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              aria-pressed={minutes === m}
              className={`rounded-md border px-3 py-1.5 font-mono transition ${
                minutes === m ? "border-cyan-500 bg-cyan-500/15 text-cyan-200" : "border-cyan-900/50 text-slate-400 hover:border-cyan-700"
              }`}
            >
              {m} min
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1.5 text-slate-400">
            <input type="checkbox" checked={focusMode} onChange={(e) => setFocusMode(e.target.checked)} className="accent-cyan-500" />
            Decoys
          </label>
          <button
            type="button"
            onClick={start}
            className="ml-auto rounded-md border border-emerald-500/60 bg-emerald-500/15 px-4 py-1.5 font-medium text-emerald-200 hover:bg-emerald-500/25"
          >
            {phase === "done" ? "Play again" : "Start mission"}
          </button>
        </div>
      )}

      {(phase === "running" || phase === "countdown") && (
        <div className="mb-3 grid grid-cols-4 gap-2 font-mono text-xs">
          <Hud label="Score" value={stats.score.toLocaleString()} />
          <Hud label="Combo" value={stats.combo ? `${stats.combo} · x${mult}` : "—"} highlight={mult > 1} />
          <Hud label="Level" value={String(level)} />
          <Hud label="Time" value={phase === "countdown" ? `${minutes}:00` : clock} />
        </div>
      )}

      <div
        role="presentation"
        onClick={() => {
          if (phase === "running") setStats((s) => ({ ...s, strays: s.strays + 1 }));
        }}
        className={`pvt-arena relative mb-4 h-72 w-full select-none overflow-hidden rounded-lg border-2 border-cyan-900/50 ${
          shaking ? "pvt-shake" : ""
        }`}
      >
        <div className="pvt-stars" aria-hidden />

        {phase === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-400">
            <span className="text-3xl">🛰️</span>
            <p>Lock onto each green beacon before it fades. Fast locks build a combo multiplier.</p>
            <p className="text-xs text-slate-500">Every {LEVEL_SECONDS} s the beacons get faster and smaller. Personal best: {best.toLocaleString()}</p>
          </div>
        )}

        {phase === "countdown" && (
          <div className="flex h-full items-center justify-center">
            <span key={count} className="pvt-count font-mono text-6xl text-cyan-200">
              {count}
            </span>
          </div>
        )}

        {phase === "running" && beacon && (
          <button
            key={beacon.id}
            type="button"
            aria-label={beacon.decoy ? "Decoy, do not tap" : "Beacon"}
            onClick={(e) => {
              e.stopPropagation();
              tapBeacon(beacon);
            }}
            style={{
              left: `calc((100% - ${beacon.size}px) * ${beacon.x})`,
              top: `calc((100% - ${beacon.size}px) * ${beacon.y})`,
              width: beacon.size,
              height: beacon.size,
              animationDuration: `${beacon.life}ms`,
            }}
            className={`pvt-beacon absolute rounded-full ${beacon.decoy ? "pvt-decoy" : ""}`}
          />
        )}

        {pops.map((p) => (
          <span
            key={p.id}
            style={{ left: `calc((100% - 80px) * ${p.x} + 10px)`, top: `calc((100% - 60px) * ${p.y})` }}
            className={`pvt-pop pointer-events-none absolute font-mono text-sm font-semibold ${
              p.tone === "good" ? "text-emerald-300" : p.tone === "bad" ? "text-red-400" : "text-cyan-300"
            }`}
          >
            {p.text}
          </span>
        ))}

        {banner && (
          <div className="pvt-pop pointer-events-none absolute inset-x-0 top-6 text-center font-mono text-lg tracking-widest text-amber-300">
            {banner}
          </div>
        )}

        {phase === "running" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              finish();
            }}
            className="absolute bottom-2 right-2 rounded border border-red-500/40 bg-black/30 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
          >
            End
          </button>
        )}

        {phase === "done" && (
          <div className="absolute inset-0 overflow-y-auto bg-[#060b16]/90 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={`text-lg font-semibold ${v.tone}`}>{v.label}</p>
              <p className="font-mono text-slate-300">
                {stats.score.toLocaleString()} pts {stats.score >= best && stats.score > 0 && <span className="text-amber-300">★ new best</span>}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-400">{v.advice}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs sm:grid-cols-6">
              <Hud label="Mean RT" value={n ? `${Math.round(mean)} ms` : "—"} />
              <Hud label="Fastest" value={n ? `${Math.round(fastest)} ms` : "—"} />
              <Hud label="Lapses" value={String(lapses)} />
              <Hud label="Accuracy" value={`${accuracy}%`} />
              <Hud label="Best combo" value={String(stats.bestCombo)} />
              <Hud label="Decoys hit" value={focusMode ? `${stats.decoyHits}/${stats.decoyHits + stats.decoyAvoided}` : "off"} />
            </div>
            <RtChart hits={stats.hits} />
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        Lapse = a beacon tapped slower than {LAPSE_MS} ms or missed entirely. Results feed the co-pilot, body map and daily missions.
      </p>
    </Card>
  );
}

function Hud({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${highlight ? "border-amber-400/50 bg-amber-400/10" : "border-mc-line bg-mc-inset"}`}>
      <div className="text-[10px] uppercase tracking-wider text-mc-label">{label}</div>
      <div className={highlight ? "text-amber-200" : "text-slate-100"}>{value}</div>
    </div>
  );
}

/** Reaction time of every lock, in order, with the 500 ms lapse line. */
function RtChart({ hits }: { hits: number[] }) {
  if (hits.length < 2) return null;
  const w = 600;
  const h = 90;
  const max = Math.max(700, ...hits);
  const bw = w / hits.length;
  const lapseY = h - (LAPSE_MS / max) * h;
  return (
    <div className="mt-3">
      <p className="mb-1 text-[10px] uppercase tracking-wider text-mc-label">Reaction time per beacon</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" preserveAspectRatio="none" role="img" aria-label="Reaction time chart">
        {hits.map((t, i) => (
          <rect
            key={i}
            x={i * bw + bw * 0.15}
            width={bw * 0.7}
            y={h - (t / max) * h}
            height={(t / max) * h}
            className={t > LAPSE_MS ? "fill-red-400/80" : t < 300 ? "fill-emerald-400/80" : "fill-cyan-400/70"}
          />
        ))}
        <line x1={0} x2={w} y1={lapseY} y2={lapseY} className="stroke-amber-300/70" strokeDasharray="6 4" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

export function getPvtSummary(): string {
  try {
    const raw = localStorage.getItem(PVT_STORAGE_KEY);
    if (!raw) return "No PVT data";
    const { mean, lapses } = JSON.parse(raw);
    return `PVT mean ${Math.round(mean)} ms, ${lapses} lapses`;
  } catch {
    return "No PVT data";
  }
}
