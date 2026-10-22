# AAHMS — Autonomous Astronaut Health Monitoring System

NASA Space Apps Challenge demo: edge AI health monitoring with **Neon PostgreSQL**, **Prisma**, **Dexie (IndexedDB)**, and **WebLLM** (browser-side inference).

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `SESSION_SECRET`.
2. `npm install`
3. `npm run db:push && npm run db:seed`
4. `npm run dev`

## Demo accounts

All seeded users share password **`aahms2025`**.

| Email | Role |
|-------|------|
| `ground@aahms.demo` | Commander (all crews) |
| `john@aahms.demo` | Astronaut EV1 (MTV-1) |
| `vance@aahms.demo` | Astronaut CDR (MTV-1) |

## Offline demo

1. Log in as an astronaut and let vitals simulate (or record manually).
2. DevTools → Network → Offline.
3. Open co-pilot chat after WebLLM model loads (requires WebGPU).
4. Go online and click **Sync to Earth** or wait for auto-sync.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS v4
- Prisma 6 + Neon PostgreSQL
- Dexie.js offline queue with `synced` flag
- `@mlc-ai/web-llm` (Llama 3.2 1B Q4)
