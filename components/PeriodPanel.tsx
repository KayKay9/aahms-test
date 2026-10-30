"use client";

import { useState } from "react";
import { CREW_PROFILES } from "@/lib/crewProfiles";
import { SYMPTOMS, adviceFor, summarize, todayISO, useCycleLog, type Flow, type Symptom } from "@/lib/periods";

const FLOWS: Flow[] = ["spotting", "light", "medium", "heavy"];
const FLOW_DOTS: Record<Flow, string> = { spotting: "•", light: "••", medium: "•••", heavy: "••••" };

const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" });

/** Period log and period-issue guidance, shown in the reproductive system on the female figure. */
export function PeriodPanel({ name }: { name: string }) {
  const { log, logDay, removeDay, setSuppressed } = useCycleLog(name);
  const s = summarize(log);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [flow, setFlow] = useState<Flow>("medium");
  const [pain, setPain] = useState(3);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const recent = [...log.days].sort((a, b) => b.date.localeCompare(a.date));
  const nsaidAllergy = /nsaid|ibuprofen/i.test(CREW_PROFILES[name]?.allergies ?? "");
  const tips = adviceFor(recent[0], nsaidAllergy);

  return (
    <div className="rounded-lg border border-pink-400/30 bg-pink-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mc-label">Period & cycle</p>
        <label className="flex items-center gap-2 text-xs text-mc-muted">
          <input type="checkbox" checked={log.suppressed} onChange={(e) => setSuppressed(e.target.checked)} className="accent-pink-400" />
          On hormone suppression
        </label>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
        <Stat label="Cycle day" value={s.cycleDay ? String(s.cycleDay) : "—"} />
        <Stat label="Last start" value={s.lastStart ? fmt(s.lastStart) : "—"} />
        <Stat label={log.suppressed ? "Next" : "Next (est.)"} value={log.suppressed ? "suppressed" : s.nextStart ? fmt(s.nextStart) : "—"} />
      </div>
      {s.avgCycle && <p className="mt-1 text-[11px] text-mc-label">Average cycle {s.avgCycle} days.</p>}

      {s.alerts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {s.alerts.map((a) => (
            <li
              key={a.text}
              className={`rounded-md border px-3 py-2 text-[13px] leading-relaxed ${
                a.level === "RED" ? "border-mc-red/50 bg-mc-red/10 text-mc-soft" : "border-mc-amber/50 bg-mc-amber/10 text-mc-soft"
              }`}
            >
              <span className={a.level === "RED" ? "font-semibold text-mc-red" : "font-semibold text-mc-amber"}>
                {a.level === "RED" ? "Call the CMO: " : "Watch: "}
              </span>
              {a.text}
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {recent.slice(0, 6).map((d) => (
            <li key={d.date} className="flex items-center gap-2">
              <span className="w-12 font-mono text-mc-label">{fmt(d.date)}</span>
              <span className="w-24 text-pink-300" title={d.flow}>
                {FLOW_DOTS[d.flow]} {d.flow}
              </span>
              <span className="flex-1 truncate text-mc-soft">
                pain {d.pain}/10{d.symptoms.length ? ` · ${d.symptoms.join(", ").toLowerCase()}` : ""}
              </span>
              <button type="button" onClick={() => removeDay(d.date)} aria-label="Remove day" className="px-1 text-mc-label hover:text-mc-red">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          className="mt-3 space-y-3 border-t border-mc-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            logDay({ date, flow, pain, symptoms });
            setOpen(false);
            setSymptoms([]);
          }}
        >
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <label className="mc-label">
              Date
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block rounded-md border border-mc-line-strong bg-mc-inset px-2 py-1.5 font-mono text-xs normal-case text-foreground"
              />
            </label>
            <div>
              <p className="mc-label">Flow</p>
              <div className="mt-1 flex overflow-hidden rounded-md border border-mc-line-strong">
                {FLOWS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={flow === f}
                    onClick={() => setFlow(f)}
                    className={`px-2.5 py-1.5 capitalize ${flow === f ? "bg-pink-500/25 text-white" : "text-mc-muted hover:bg-mc-raised"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="block text-xs text-mc-muted">
            Pain: <span className="font-mono text-foreground">{pain}/10</span>
            <input type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="mt-1 w-full accent-pink-400" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOMS.map((sym) => {
              const on = symptoms.includes(sym);
              return (
                <button
                  key={sym}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSymptoms((cur) => (on ? cur.filter((x) => x !== sym) : [...cur, sym]))}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    on ? "border-pink-400 bg-pink-500/20 text-white" : "border-mc-line text-mc-muted hover:border-mc-line-strong"
                  }`}
                >
                  {sym}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md border border-pink-400/60 bg-pink-500/15 px-4 py-1.5 text-sm text-pink-100 hover:bg-pink-500/25">
              Save day
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-mc-label hover:text-white">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDate(todayISO());
            setOpen(true);
          }}
          className="mt-3 text-xs text-pink-300 hover:underline"
        >
          + Log a period day
        </button>
      )}

      <div className="mt-3 border-t border-mc-line pt-3">
        <p className="mc-label">Self-care</p>
        <ul className="mt-2 space-y-1.5">
          {tips.map((t) => (
            <li key={t} className="flex gap-2 text-[13px] leading-relaxed text-mc-soft">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pink-400" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-mc-label">
          Call the CMO for bleeding over 7 days, soaking a pad or tampon every hour, severe or one-sided pain, fever, or dizziness.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-mc-line bg-mc-inset px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-mc-label">{label}</div>
      <div className="text-slate-100">{value}</div>
    </div>
  );
}
