"use client";

import { useEffect, useRef, useState } from "react";
import { SpaceScene, SUN_SCREEN_DIR } from "@/components/login/SpaceScene";

const MISSION_EPOCH = Date.UTC(2026, 0, 15);
const LAUNCH_MS = 900;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Mission elapsed time; renders a placeholder on the server so hydration matches. */
function MissionClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  if (now == null) return <span>MET ---/--:--:--</span>;
  const s = Math.floor((now - MISSION_EPOCH) / 1000);
  return (
    <span>
      MET {String(Math.floor(s / 86400)).padStart(3, "0")}/{pad(Math.floor(s / 3600) % 24)}:
      {pad(Math.floor(s / 60) % 60)}:{pad(s % 60)}
    </span>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [launching, setLaunching] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // The card floats in the same space as the scene: it drifts and tilts with the
  // pointer (opposite the stars, like a nearer object) and its glass catches the sun.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tx = 0, ty = 0, px = 0, py = 0, raf = 0;
    const onMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      py = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const loop = () => {
      tx += (px - tx) * 0.06;
      ty += (py - ty) * 0.06;
      card.style.transform = `perspective(1100px) translate3d(${tx * 10}px, ${ty * 10}px, 0) rotateY(${tx * 4}deg) rotateX(${-ty * 4}deg)`;
      const sx = SUN_SCREEN_DIR.x - tx * 0.3, sy = SUN_SCREEN_DIR.y - ty * 0.3;
      card.style.setProperty("--sheen-x", `${50 + sx * 60}%`);
      card.style.setProperty("--sheen-y", `${50 + sy * 60}%`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  async function signIn(body: Record<string, unknown>) {
    setLaunching(true);
    setError("");
    const minLaunch = new Promise((r) => setTimeout(r, LAUNCH_MS));
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        setLaunching(false);
        return;
      }
      await minLaunch;
      // Full navigation so the new session cookie is sent fresh; if the console
      // bounces back here, the page reloads instead of spinning forever.
      window.location.assign("/");
    } catch {
      setError("Cannot reach mission control. Check the dev server.");
      setLaunching(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void signIn({ email: email || "crew@aahms.demo", password: password || "demo" });
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white placeholder:text-slate-400/50 transition focus:border-sky-300/50 focus:bg-black/35 focus:shadow-[0_0_0_3px_rgba(125,211,252,0.12)] focus:outline-none";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#01030a] text-slate-200">
      <SpaceScene warp={launching} />

      {/* Subtle vignette so text stays readable over bright Earth */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_70%_45%,transparent_30%,rgba(1,3,10,0.55)_100%)]" />

      <header
        className={`pointer-events-none fixed left-5 right-5 top-5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300/80 transition-opacity duration-500 ${
          launching ? "opacity-0" : ""
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          AAHMS · MTV-1 Mars Transit
        </span>
        <span className="hidden sm:inline">
          <MissionClock />
        </span>
      </header>

      <div
        className={`pointer-events-none fixed bottom-8 left-6 hidden max-w-sm transition-opacity duration-500 md:block ${
          launching ? "opacity-0" : ""
        }`}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-sky-200/70">
          Autonomous Astronaut Health Monitoring
        </p>
        <h2 className="mt-2 text-xl font-light leading-snug text-white/90">
          A flight surgeon that rides along, 20 light-minutes from Earth.
        </h2>
      </div>

      <main className="pointer-events-none relative z-10 flex min-h-screen items-center justify-center p-4 md:justify-end md:pr-[8vw]">
        <div ref={cardRef} className="pointer-events-auto w-full max-w-sm will-change-transform">
          <form
            onSubmit={onSubmit}
            style={{
              backgroundImage:
                "radial-gradient(circle at var(--sheen-x, 20%) var(--sheen-y, 15%), rgba(255,240,220,0.16), transparent 55%), linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
            }}
            className={`rise-in rounded-3xl border border-white/15 p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl backdrop-saturate-150 ${
              launching ? "launch-out" : ""
            }`}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-sky-200/70">
              Mission console
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">AAHMS // Edge AI</h1>
            <p className="mt-1 text-xs text-slate-300/70">Sign in to monitor crew health.</p>

            {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
            <label className="mt-6 block text-xs text-slate-300/80">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@crew.space"
                className={inputClass}
              />
            </label>
            <label className="mt-4 block text-xs text-slate-300/80">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="anything works in demo"
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={launching}
              className="group relative mt-7 w-full overflow-hidden rounded-xl bg-white/90 py-3 text-sm font-semibold text-slate-900 shadow-[0_10px_30px_-10px_rgba(147,197,253,0.6)] transition hover:bg-white disabled:opacity-80"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-sky-200/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">{launching ? "Launching…" : "Enter console"}</span>
            </button>
            <p className="mt-5 text-center text-[10px] text-slate-400/60">
              Demo build · any email and password signs in
            </p>
          </form>
        </div>
      </main>

      <p className="pointer-events-none fixed bottom-3 right-4 text-[9px] text-slate-500/60">
        Earth imagery: NASA Blue Marble &amp; Black Marble
      </p>
    </div>
  );
}
