# 🌱 CarbonSync — Your Personal Carbon Coach

[![CI](https://github.com/ashfaque-rifaye/carbon-footprint-awareness/actions/workflows/ci.yml/badge.svg)](https://github.com/ashfaque-rifaye/carbon-footprint-awareness/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

**A personalized carbon coach that finds the biggest emission drivers in a person's
life and gives the next best action, ranked by impact and effort.**

> PromptWars Challenge 3 · Vertical: **Sustainability / Carbon Footprint Awareness**

---

## 1. Problem

Most carbon tools are static calculators: they spit out a number, make people feel
guilty, and get abandoned. Individuals don't know _which_ of their habits matters
most or _what to do next_. The challenge: help people **understand, track, and
reduce** their personal carbon footprint through simple actions and personalized
insights.

## 2. Solution Summary

CarbonSync logs a user's everyday carbon-saving actions (transport, energy, diet,
waste), scores their footprint progress, and uses a **Gemini-powered coach** to:

1. pinpoint the user's **biggest emission driver** from their own activity,
2. recommend the **next best actions, ranked by impact-per-effort**, and
3. answer follow-up questions through a grounded **conversational assistant**.

A behavior-change loop (points, streaks, milestones, leaderboard) keeps people
coming back.

## 3. Why This Beats a Generic "Eco Assistant"

A generic assistant says _"use public transport."_ CarbonSync says:

> _"Transport is ~90% of your savings so far. Food is your biggest untapped area —
> swapping beef for a plant-based dinner twice this week saves ~5.2 kg CO₂, more
> than any single energy tweak right now."_

The difference is **context-aware ranking**. We don't ask the model to guess: a
deterministic analytics layer computes the real category breakdown and the
top driver, hands it to the model as ground truth, and re-ranks the returned
actions by **kg CO₂ saved ÷ effort** so the _single best next step_ is always
first. That is a real assistant, not a template.

## 4. Architecture (one paragraph)

A **React + TypeScript frontend** (input, dashboard, recommendations) talks to a
thin **Express backend** that owns the Gemini key, all data persistence, and
authentication. A pure **rules + analytics engine** (`src/lib/carbon.ts`,
`src/lib/footprint.ts`) does all emissions scoring, category breakdown, and
impact/effort ranking. An **LLM layer** (`src/lib/insights.ts`, `src/lib/chat.ts`)
handles explanation, personalization, and next-step guidance. A **local SQLite
database** (`src/lib/db.ts`, via `better-sqlite3`) stores accounts, the activity
ledger, and login sessions — no external or cloud database is used. **Email +
password auth** (`src/lib/auth.ts`) hashes credentials with Node's built-in
scrypt and issues an httpOnly session cookie. If the AI is unavailable,
deterministic fallbacks keep every feature working.

```
Frontend (React)  ──►  Email + password auth (httpOnly session cookie)
   │  user actions + profile
   ▼
Express API  ──►  Rules + Analytics engine   (scoring, top-driver, ranking)
   │              carbon.ts · footprint.ts
   ├──►  LLM layer (Gemini)  ──►  insights.ts (JSON coach) · chat.ts (assistant)
   │        validated + re-ranked output
   ▼
Local SQLite DB (db.ts)  ──  users · emissions_logs · sessions
```

## 5. Logic Flow

1. User logs an action (challenge, custom offset, or simulated device event).
2. The server (`carbon.ts`) authoritatively computes points, streak, and CO₂
   saved; the entry is written to the local SQLite activity ledger.
3. `footprint.ts` aggregates the ledger into a **category breakdown** and finds the
   **top emission driver** plus untapped categories.
4. `insights.ts` builds a CO-STAR prompt that includes that precomputed analysis;
   Gemini returns a review + 3 candidate actions as strict JSON.
5. The server **re-ranks** the actions by impact-per-effort and returns them, so
   the UI's first suggestion is the highest-leverage next step.
6. The user can ask follow-ups in the **conversational assistant** (`chat.ts`),
   grounded in their live stats.

### Core decision logic (pure & unit-tested)

| Concern          | Module · function                     | Rule                                                   |
| ---------------- | ------------------------------------- | ------------------------------------------------------ |
| Scoring          | `carbon.calculatePoints`              | 25 base + 10 per kg CO₂                                |
| Streaks          | `carbon.nextStreak`                   | +1 consecutive day, reset after a gap                  |
| Transport offset | `carbon.calculateTransitSavings`      | distance × mode factor vs. ~0.22 kg/km petrol baseline |
| Top driver       | `footprint.summarizeByCategory`       | aggregates ledger, ranks categories by CO₂             |
| Next best action | `footprint.rankActionsByImpactEffort` | kg saved ÷ effort weight (Free<Low<Medium)             |

## 6. Prompt Strategy

Prompts are engineered, not ad-hoc (`src/lib/insights.ts`, `src/lib/chat.ts`):

- **CO-STAR** — every prompt has explicit Context, Objective, Style, Tone,
  Audience, and Response-format sections.
- **Grounded analysis** — the precomputed top-driver/untapped-category summary is
  injected as "ground truth" so advice targets the user's real footprint.
- **Few-shot** — the insights prompt embeds a one-shot JSON exemplar; the chat
  prompt embeds two Q&A exemplars to lock structure and tone.
- **Chain-of-Thought** — the model reasons step-by-step _internally_ (read
  analysis → rank by impact/effort → best step first); for the JSON endpoint the
  reasoning is kept **out** of the output to preserve strict format.
- **Strict format + validation** — the insights endpoint must return one raw JSON
  object (exactly 3 actions, enumerated `cost`); the server validates, coerces,
  and re-ranks before the UI sees it.
- **Anti-hallucination** — only validated user stats are passed; the model is told
  never to invent personal data. Verified live: with the transport tracker off,
  the coach recommended _manual_ logging instead of a fake auto-feed.

## 7. Assumptions

- IoT devices are **simulated** — no hardware needed. Emission factors
  (~0.22 kg CO₂/km petrol; ~22 kg CO₂/tree/yr) are representative, not certified.
- The leaderboard seeds with sample competitors alongside real registered users.
- Storage is a **local SQLite file** (no cloud database). On an ephemeral host
  like Cloud Run the file lives at `DB_PATH` (e.g. `/tmp/carbonsync.db`) and
  persists for the instance's lifetime; run with `--min-instances=1` (or mount a
  volume / point `DB_PATH` at a non-Google managed SQL host such as Turso) for
  durable persistence.

## 8. Testing

`npm test` runs **97 unit tests** (Vitest) over the decision, auth, and data logic:

- `carbon.test.ts` — scoring, streaks, offsets, equivalence, edge cases.
- `footprint.test.ts` — category aggregation, top-driver detection, impact/effort
  ranking, focus-summary text.
- `insights.test.ts` — input bounding, CO-STAR/few-shot/CoT prompt structure,
  footprint injection, defensive JSON parsing, **action re-ranking**, fallback.
- `chat.test.ts` — history validation, prompt grounding, content mapping,
  keyword fallback.
- `auth.test.ts` — scrypt hash/verify (incl. constant-time + garbage inputs),
  email validation, registration/login payload validation.
- `db.test.ts` — runs against an in-memory SQLite DB: user creation, duplicate-email
  rejection, session lifecycle, owner-scoped log CRUD, stats/profile updates,
  leaderboard ranking, and row→DTO mapping (no secret leakage).

## 9. How to Run

**Prerequisites:** Node.js 18+.

```bash
npm install                       # install deps
cp .env.example .env.local        # then set GEMINI_API_KEY in .env.local (gitignored)
npm run dev                       # full-stack dev server on http://localhost:3000
```

```bash
npm test          # unit tests (Vitest)
npm run lint      # ESLint + type-check (tsc --noEmit)
npm run format    # auto-format with Prettier
npm run build     # production build (client bundle + server.cjs)
npm start         # serve the production build
```

### Project structure

```
server.ts              Express API: auth, activity, AI proxy (owns the Gemini key)
src/
  App.tsx              Thin orchestrator: session state + data fetching, renders Landing/Dashboard
  components/
    LandingPage.tsx    Public marketing + login/register view
    Dashboard.tsx      Authenticated dashboard shell (stat cards, tabs, panels)
    DeviceSimulator.tsx  Simulated smart-meter + transport IoT telemetry
    AiInsights.tsx     AI coach panel (calls /api/insights)
    EcoAssistant.tsx   Conversational chat panel (calls /api/chat)
    CommunityLeaderboard.tsx  Standings + social hub
    AvatarIcon.tsx     Shared avatar→icon mapping (single source of truth)
    Markdown.tsx       Shared safe Markdown renderer
  lib/
    carbon.ts          Pure scoring/streak/transit math
    footprint.ts       Category breakdown + impact/effort ranking (the "coach" intelligence)
    insights.ts        Insights prompt build/parse/validate + deterministic fallback
    chat.ts            Chat prompt build + deterministic fallback
    auth.ts            scrypt hashing + credential validation
    db.ts              SQLite store (users, emissions_logs, sessions)
  types.ts             Shared domain types + static challenge/milestone data
```

The codebase is enforced by **TypeScript `strict`** (with `noUnusedLocals`/
`noUnusedParameters`), **ESLint** (typescript-eslint + react-hooks), and
**Prettier**. UI logic lives in small components; all carbon math and AI
prompt/parse logic is isolated in pure, unit-tested `lib/` modules.

Sample API call:

```bash
curl -s localhost:3000/api/insights -H "Content-Type: application/json" -d '{
  "userProfile":{"name":"Maya","streakDays":4,"smartMeterConnected":true},
  "recentLogs":[{"category":"transport","kgSaved":4.4,"activityName":"Cycled commute"}]
}'
# → { "insights": "### ... Transport is your top driver ...",
#     "actions": [ { "id":"meatless_dinner","text":"...","savedKg":5.2,"cost":"Low" }, ... ] }
```

## 10. Security & Accessibility (built in)

- **Security:** Gemini key is server-side only (gitignored `.env.local`); request
  bodies are size-limited and every field validated before use; passwords are
  hashed with scrypt (never stored or logged in plaintext) and compared in
  constant time; auth uses an httpOnly, SameSite=Lax, `Secure`-in-production
  session cookie; every data endpoint is session-guarded and all queries are
  owner-scoped with parameterized SQL (no injection); model output is parsed
  defensively and never executed.
- **Accessibility:** skip link, semantic landmarks, real `<button>`s for every
  action (no click-handlers on `div`s), `aria-label`s on icon buttons,
  `aria-pressed` on toggles, `role="tab"`/`aria-selected` navigation, `aria-live`
  status regions, labeled inputs, visible focus rings, and a
  `prefers-reduced-motion` block that disables animation for users who opt out.
  (Full WCAG sign-off needs manual assistive-tech testing.)

## 11. Future Improvements

- Persist AI recommendations and track "action taken → CO₂ saved" over time.
- Location- and budget-aware factors (regional grid mix, local transit options).
- Weekly goal engine that adapts targets from trend detection.

---

### Efficiency notes

The client JS payload is kept lean by carrying **zero heavy UI dependencies**:
Firebase (~460 kB) and the animation library framer-motion (~140 kB) were both
removed — entrance animations are now pure CSS, cutting roughly **a third** off the
JavaScript bundle. React is split into a cacheable vendor chunk; `lucide-react`
icons are tree-shaken. On the data side, the smart-meter telemetry interval is
created once per connect (not re-subscribed on every tick), logs sent to the model
are capped (`MAX_RECENT_LOGS`), analytics run as O(n) passes over the activity log,
and SQLite reads are indexed and use prepared statements. The codebase compiles
under TypeScript `strict` with `noUnusedLocals`/`noUnusedParameters` (no dead code).
