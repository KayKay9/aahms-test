# AAHMS · Autonomous Astronaut Health Monitoring System

A NASA Space Apps Challenge prototype: a self-assessment health console for astronauts on long missions. Our scenario is the MTV-1 Mars transit, 20 light-minutes from Earth.

Crew members measure their own health and see colour-coded results with plain-language explanations. When something is wrong, an on-device AI co-pilot tells them what to do, and it keeps working when the link to Earth is down.

> Concept prototype for a hackathon. Not an official NASA system and not medical advice.

## How it meets the challenge

| Challenge asks for | AAHMS |
|---|---|
| Astronauts assess their own health | Each crew member signs in to their own console, takes a guided **Daily self-check**, and sees their own vitals |
| Indicators: blood pressure, heart rate, blood sugar, temperature, sleep, mood | All six, plus HRV, SpO₂, radiation dose, cabin CO₂, exercise and a reaction-time test |
| Guidance on treatment and improvement | Advice on every reading, plus an **AI co-pilot** with ISS-style protocols, crew baselines and the medicine kit |
| When to involve crew or flight surgeons | Red results prompt **Alert CMO + send to ground surgeon** |
| NASA HRP's five hazards | **RIDGE strip** (Radiation, Isolation, Distance, Gravity, hostile Environment), linked to the body systems each one affects |
| Clickable human figure | **Body map**: brain, eyes, heart, lungs, blood, bones & muscles and reproductive health, each with status, what it does, how space affects it and what to do |
| Prompts and routine | Morning self-check banner, exercise and sleep voice reminders |
| Gamification | **Health missions** with points, streaks and mission patches |
| Charts over time | Live ECG, 24 h HRV trend, exercise and sleep progress |
| Colour coding | Green / amber / red everywhere, following NASA-STD-3001 caution & warning colours |
| Simple instructions | Each measurement has numbered "how to measure" steps and a "why this matters in space" note |

## Features

### Daily self-check
Five guided steps:
- **Blood pressure** (mmHg)
- **Blood sugar** (mg/dL, fasting or after a meal)
- **Body temperature** (°C)
- **Mood** (5 faces + a private note)
- **Sleep** (pre-filled from the sleep log)

Results turn green, amber or red as they're typed, with advice, and readings a device couldn't show are caught as typos. The results screen offers **Ask the co-pilot about my results**. When anything is red, it also offers **Alert CMO + send to ground surgeon**.

### Body map + five hazards
- An anatomical astronaut figure with a clickable status point per body system.
- Each system shows its readings, what it does, how spaceflight affects it, and what to do now.
- Injury and period tracking are built in.
- The **RIDGE** strip shows a live status for each hazard. Picking one highlights the body systems it affects.

### Crew vitals
- Big heart rate, SpO₂ and HRV tiles.
- A realistic Lead II ECG: PQRST beats, HRV-driven rhythm and a monitor sweep. It turns irregular in the arrhythmia scenario.
- 24 h HRV trend, plus per-crew baselines and a crew overview.

### Health missions
- Four daily core missions: self-check, exercise plan, 7 h sleep and the reaction-time test. Reviewing the body map is a bonus.
- Points, a 🔥 streak and eight mission patches.
- Patches reward habits, never health values.

### Habitat & routine
- Cabin CO₂ and radiation dose against flight-rule limits, with a scrubber/shielding boost.
- Exercise log for ARED, treadmill and cycle against an ISS-style plan.
- Sleep log and spoken reminders.

### Cognitive test
- **Beacon Lock**: a reaction-time (PVT) game that measures alertness and lapses.

### AI co-pilot
- Runs **Llama 3.2 1B** fully in the browser with [WebLLM](https://github.com/mlc-ai/web-llm), so no data leaves the vehicle.
- It gets the crew's vitals, baselines, protocols, medicine kit, today's self-check and habitat data.
- **Basic mode:** without WebGPU, or when the model can't load, it falls back to built-in triage rules with no errors.
- On GPUs without `shader-f16` it uses f32 builds, and it tries a smaller model before giving up.

### Offline first
- Vitals are saved to IndexedDB (Dexie) and synced to Postgres with **Sync to Earth** when the link is back.

### Demo scenarios
The header's **Demo** dropdown switches between:
- Nominal
- Arrhythmia · 20m latency
- EV1 voice stress
- ppCO₂ + PVT slowdown
- Solar particle event

## Getting started

Requirements: Node 20+, and a PostgreSQL database such as [Neon](https://neon.tech) or local Docker.

```bash
cp .env.example .env      # then fill in DATABASE_URL and SESSION_SECRET
npm install
npm run db:push           # create the tables
npm run db:seed           # demo crew (only on an empty database)
npm run dev               # http://localhost:3000
```

For the full AI co-pilot, use Chrome or Edge 113+ on a computer with a WebGPU-capable GPU. Other browsers still work in basic mode.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | Long random string used to sign the login cookie |
| `DEMO_MODE` | no | `true` lets any email/password sign in and auto-creates the crew profile. Defaults to on outside production and off in production. **Set `false` for any public deployment.** |
| `NEXT_PUBLIC_WEBLLM_MODEL` | no | Pin a WebLLM model, e.g. `SmolLM2-360M-Instruct-q4f16_1-MLC` for a much smaller download |

### Demo accounts

All seeded users share the password **`aahms2025`**. In demo mode, any password works.

| Email | Role |
|---|---|
| `ground@aahms.demo` | Commander, sees all crews |
| `john@aahms.demo` | Astronaut EV1 (MTV-1) |
| `vance@aahms.demo` | Astronaut CDR (MTV-1) |
| `cho@aahms.demo`, `silva@aahms.demo`, `reyes@aahms.demo`, `park@aahms.demo`, `okonkwo@aahms.demo` | Other crew |

## Five-minute demo script
1. Sign in as `john@aahms.demo`.
2. **Crew vitals:** follow the "Morning self-check due" banner and do the check. Try BP `165/102` to see a red result and the CMO alert.
3. **Body map:** click the regions, then pick **G** (Gravity) in the hazards strip to see which systems it affects.
4. **Missions:** use the **Go** buttons to finish the exercise plan (log 46 min), sleep (22:30 → 06:00) and **Beacon Lock**. The ring hits 4/4 and the patches unlock.
5. Switch **Demo → Solar particle event** and watch radiation, the body map and the assessment react.
6. **Ask the co-pilot** a question, e.g. "I feel dizzy, what should I do?"
7. **Offline:** in DevTools set Network → Offline, record vitals, go back online, then click **Sync to Earth**.

## Tech stack
- **Next.js 16** (App Router, built with webpack), **React 19**, TypeScript, **Tailwind CSS v4**
- **Prisma 6** + **PostgreSQL** (Neon); JWT session cookie (`jose`)
- **Dexie** (IndexedDB) store-and-forward queue
- **@mlc-ai/web-llm** in a Web Worker: idle preload, warmup, streaming replies, cached weights

## Project structure

```
app/                 Next.js routes (login, console, API: auth, dashboard, biometrics sync)
components/          UI: SuperAdminDashboard (console), BodyMap, DailySelfCheck, HealthMissions,
                     VitalsMonitor + EcgMonitor, ExerciseSleep, PVTTest, OfflineAICopilot, …
lib/                 Logic: risk rules, selfCheck, bodyMap (+ hazards), missions, routineLog,
                     injuries, periods, copilot knowledge/fallback, webllm engine, Dexie db
prisma/              Schema and seed data
```

## Notes and limits
- Thresholds and advice are demo guidance based on common clinical cut-offs and NASA Human Research Program summaries. They are not medical advice.
- The self-check, missions and some logs are stored in the browser for now. Vitals sync to the database.
- "Send to ground surgeon" confirms on screen. It isn't wired to the sync queue yet.
- The first co-pilot load downloads about 0.7 GB of model weights once. After that they're cached in the browser.
