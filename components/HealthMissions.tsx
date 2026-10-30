"use client";

import { Card } from "./ui/Card";
import { CircularProgress } from "./ui/CircularProgress";
import { useHealthMissions } from "@/lib/missions";

/** Daily health missions with streak, points and mission-patch badges. */
export function HealthMissions({ userId, onGo }: { userId: string; onGo: (tab: string) => void }) {
  const { tasks, streak, points, badges, remaining } = useHealthMissions(userId);
  const core = tasks.filter((t) => t.core);
  const doneCore = core.filter((t) => t.done).length;

  return (
    <div className="flex flex-col gap-5">
      <Card title="Today's health missions">
        <div className="flex flex-wrap items-center gap-6">
          <CircularProgress
            size={112}
            strokeWidth={9}
            percent={(doneCore / core.length) * 100}
            trackClassName="stroke-mc-line"
            progressClassName={doneCore === core.length ? "stroke-mc-green" : "stroke-mc-select"}
          >
            <div className="font-mono text-2xl">
              {doneCore}/{core.length}
            </div>
            <div className="font-mono text-[10px] text-mc-label">CORE DONE</div>
          </CircularProgress>
          <div className="flex gap-6">
            <div>
              <p className="mc-label">Streak</p>
              <p className="font-mono text-3xl">
                🔥 {streak}
                <span className="text-sm text-mc-label"> day{streak === 1 ? "" : "s"}</span>
              </p>
            </div>
            <div>
              <p className="mc-label">Points</p>
              <p className="font-mono text-3xl">{points}</p>
            </div>
          </div>
          <p className="min-w-48 flex-1 text-sm text-mc-muted">
            {remaining === 0
              ? "All core missions done today. Great work, the streak is safe."
              : `${remaining} core mission${remaining === 1 ? "" : "s"} left to keep your streak going.`}
          </p>
        </div>

        <ul className="mt-5 divide-y divide-mc-line rounded-md border border-mc-line">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  t.done ? "border-mc-green bg-mc-green/20 text-mc-green" : "border-mc-line-strong text-transparent"
                }`}
                aria-hidden
              >
                ✓
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${t.done ? "text-mc-muted line-through" : ""}`}>
                  {t.title}
                  {!t.core && <span className="ml-2 rounded bg-mc-raised px-1.5 py-0.5 font-mono text-[10px] text-mc-label">BONUS</span>}
                </p>
                <p className="text-xs text-mc-label">{t.detail}</p>
              </div>
              <span className="font-mono text-xs text-mc-link">+{t.points}</span>
              {!t.done && (
                <button
                  type="button"
                  onClick={() => onGo(t.tab)}
                  className="min-h-9 rounded-md border border-mc-nasa-edge px-3 text-xs font-semibold text-[#b5d2ff] hover:bg-mc-nasa/30"
                >
                  Go
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Mission patches">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center ${
                b.earned ? "border-mc-amber/50 bg-mc-amber/10" : "border-mc-line bg-mc-inset opacity-60"
              }`}
            >
              <span className={`text-3xl ${b.earned ? "" : "grayscale"}`} aria-hidden>
                {b.icon}
              </span>
              <span className="text-sm font-semibold">{b.name}</span>
              <span className="text-[11px] leading-snug text-mc-label">{b.how}</span>
              <span className={`font-mono text-[10px] ${b.earned ? "text-mc-amber" : "text-mc-label"}`}>
                {b.earned ? "EARNED" : "LOCKED"}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-mc-label">
          Patches reward healthy habits, never health values, so nobody is penalised for being unwell.
        </p>
      </Card>
    </div>
  );
}
