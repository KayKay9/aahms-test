"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("john@aahms.demo");
  const [password, setPassword] = useState("aahms2025");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070b14] p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-cyan-900/50 bg-[#0d1526] p-8"
      >
        <h1 className="text-xl font-semibold text-cyan-100">AAHMS // EDGE AI</h1>
        <p className="mt-1 text-sm text-slate-500">Mission console sign-in</p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <label className="mt-6 block text-xs text-slate-400">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-4 block text-xs text-slate-400">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded bg-cyan-600 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Enter console"}
        </button>
        <p className="mt-4 text-[10px] text-slate-600">
          Demo: ground@aahms.demo or john@aahms.demo · password aahms2025
        </p>
      </form>
    </div>
  );
}
