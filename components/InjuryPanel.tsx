"use client";

import { useState } from "react";
import {
  INJURY_TYPES,
  BODY_AREAS,
  compressPhoto,
  injuryLevel,
  type Injury,
  type InjuryType,
  type InjuryUpdate,
} from "@/lib/injuries";

const TONE = {
  GREEN: { text: "text-mc-green", ring: "border-mc-green/50", bg: "bg-mc-green/10", label: "HEALED / MILD" },
  YELLOW: { text: "text-mc-amber", ring: "border-mc-amber/60", bg: "bg-mc-amber/10", label: "HEALING" },
  RED: { text: "text-mc-red", ring: "border-mc-red/70", bg: "bg-mc-red/10", label: "SEVERE PAIN" },
} as const;

const fmt = (t: number) =>
  new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Pain, note and optional camera photo: shared by a new report and a follow-up check. */
function UpdateForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (u: InjuryUpdate) => void }) {
  const [pain, setPain] = useState(4);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ at: Date.now(), pain, note: note.trim(), photo });
        setNote("");
        setPhoto(undefined);
      }}
    >
      <label className="block text-xs text-mc-muted">
        Pain right now: <span className={`font-mono ${pain >= 7 ? "text-mc-red" : pain >= 1 ? "text-mc-amber" : "text-mc-green"}`}>{pain}/10</span>
        <input type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="mt-1 w-full accent-cyan-500" />
      </label>
      <label className="block text-xs text-mc-muted">
        What happened / how it looks
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. caught hand on a panel edge, 2 cm cut"
          className="mt-1 w-full rounded-md border border-mc-line-strong bg-mc-inset px-2.5 py-2 text-sm text-foreground"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {/* capture="environment" opens the rear camera on phones and tablets; laptops get a file picker or webcam */}
        <label className="cursor-pointer rounded-md border border-mc-line-strong px-3 py-1.5 text-xs text-mc-soft hover:bg-mc-raised">
          📷 {photo ? "Retake photo" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                setPhoto(await compressPhoto(f));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {busy && <span className="text-xs text-mc-label">processing…</span>}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
          <img src={photo} alt="Injury photo preview" className="h-14 w-14 rounded object-cover" />
        )}
        <button type="submit" className="ml-auto rounded-md border border-cyan-500/60 bg-cyan-500/15 px-4 py-1.5 text-sm text-cyan-100 hover:bg-cyan-500/25">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function FirstAid({ type }: { type: InjuryType }) {
  const t = INJURY_TYPES[type];
  return (
    <div className="space-y-3">
      <div>
        <p className="mc-label">First aid</p>
        <ol className="mt-2 space-y-1.5">
          {t.steps.map((s, i) => (
            <li key={s} className="flex gap-2 text-sm leading-relaxed text-mc-soft">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 font-mono text-[11px] text-cyan-200">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
      <p className="rounded-md border border-mc-red/40 bg-mc-red/10 px-3 py-2 text-[13px] leading-relaxed text-mc-soft">
        <span className="font-semibold text-mc-red">When to escalate: </span>
        {t.escalate} Earth is 20 minutes away, so start care onboard.
      </p>
    </div>
  );
}

export function NewInjuryPanel({
  spot,
  onAreaChange,
  onReport,
  onCancel,
}: {
  spot: { x: number; y: number; area: string };
  onAreaChange: (area: { name: string; x: number; y: number }) => void;
  onReport: (type: InjuryType, first: InjuryUpdate) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<InjuryType>("cut");
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xl font-semibold">Report injury</h3>
          <button type="button" onClick={onCancel} className="text-xs text-mc-label hover:text-white">
            Cancel
          </button>
        </div>
        <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mc-muted">
          Location
          <select
            value={spot.area}
            onChange={(e) => {
              const a = BODY_AREAS.find((b) => b.name === e.target.value);
              if (a) onAreaChange(a);
            }}
            className="rounded-md border border-mc-line-strong bg-mc-inset px-2 py-1.5 text-sm text-foreground"
          >
            {BODY_AREAS.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-mc-label">Wrong spot? Pick the exact area here, or tap the figure again.</span>
        </label>
      </div>
      <div>
        <p className="mc-label">Type</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(INJURY_TYPES) as InjuryType[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              onClick={() => setType(k)}
              className={`rounded-md border px-2 py-2 text-left text-xs transition ${
                type === k ? "border-cyan-400 bg-cyan-500/15 text-white" : "border-mc-line bg-mc-inset text-mc-soft hover:border-mc-line-strong"
              }`}
            >
              <span className="mr-1">{INJURY_TYPES[k].icon}</span>
              {INJURY_TYPES[k].label}
            </button>
          ))}
        </div>
      </div>
      <UpdateForm submitLabel="Save report" onSubmit={(u) => onReport(type, u)} />
      <FirstAid type={type} />
    </div>
  );
}

export function InjuryDetail({
  injury,
  onUpdate,
  onHealed,
  onRemove,
  onClose,
}: {
  injury: Injury;
  onUpdate: (u: InjuryUpdate) => void;
  onHealed: (healed: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = INJURY_TYPES[injury.type];
  const level = injuryLevel(injury);
  const tone = TONE[level];
  // Day of care as of the latest check (render stays pure: no clock read here).
  const lastAt = injury.updates[injury.updates.length - 1]?.at ?? injury.reportedAt;
  const days = Math.floor((lastAt - injury.reportedAt) / 86_400_000);
  const first = injury.updates[0]?.pain ?? 0;
  const last = injury.updates[injury.updates.length - 1]?.pain ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-lg border p-4 ${tone.ring} ${tone.bg}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-semibold">
            {t.icon} {t.label}
          </h3>
          <span className={`font-mono text-sm font-semibold ${tone.text}`}>● {injury.healed ? "HEALED" : tone.label}</span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-mc-label">
          {injury.area} · reported {fmt(injury.reportedAt)} · day {days + 1} · pain {first} → {last}
        </p>
        <button type="button" onClick={onClose} className="mt-2 text-xs text-mc-link underline">
          Back to body systems
        </button>
      </div>

      {!injury.healed && <FirstAid type={injury.type} />}

      <div>
        <p className="mc-label">Healing log</p>
        <ul className="mt-2 space-y-2">
          {injury.updates.map((u) => (
            <li key={u.at} className="flex gap-3 rounded-md border border-mc-line bg-mc-inset p-2">
              {u.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data URL from the camera
                <img src={u.photo} alt={`Injury photo ${fmt(u.at)}`} className="h-16 w-16 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-mc-line text-xl">{t.icon}</span>
              )}
              <div className="min-w-0 text-xs">
                <p className="font-mono text-mc-label">
                  {fmt(u.at)} · pain{" "}
                  <span className={u.pain >= 7 ? "text-mc-red" : u.pain >= 1 ? "text-mc-amber" : "text-mc-green"}>{u.pain}/10</span>
                </p>
                {u.note && <p className="mt-1 text-sm text-mc-soft">{u.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {!injury.healed && (
        <div className="rounded-md border border-mc-line p-3">
          <p className="mc-label mb-2">Daily check</p>
          <UpdateForm submitLabel="Add check" onSubmit={onUpdate} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          onClick={() => onHealed(!injury.healed)}
          className="rounded-md border border-mc-green/50 px-3 py-1.5 text-mc-green hover:bg-mc-green/10"
        >
          {injury.healed ? "Reopen" : "✓ Mark healed"}
        </button>
        <button type="button" onClick={onRemove} className="rounded-md px-3 py-1.5 text-mc-label hover:text-mc-red">
          Delete report
        </button>
      </div>
    </div>
  );
}
