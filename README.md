# 🌱 CarbonSync — Your Personal Carbon Coach

**A personalized carbon coach that finds the biggest emission drivers in a person's
life and gives the next best action, ranked by impact and effort.**

> PromptWars Challenge 3 · Vertical: **Sustainability / Carbon Footprint Awareness**

---

## 1. Problem

Most carbon tools are static calculators: they spit out a number, make people feel
guilty, and get abandoned. Individuals don't know *which* of their habits matters
most or *what to do next*. The challenge: help people **understand, track, and
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

A generic assistant says *"use public transport."* CarbonSync says:

> *"Transport is ~90% of your savings so far. Food is your biggest untapped area —
> swapping beef for a plant-based dinner twice this week saves ~5.2 kg CO₂, more
> than any single energy tweak right now."*

The difference is **context-aware ranking**. We don't ask the model to guess: a
deterministic analytics layer computes the real category breakdown and the
top driver, hands it to the model as ground truth, and re-ranks the returned
actions by **kg CO₂ saved ÷ effort** so the *single best next step* is always
first. That is a real assistant, not a template.

## 4. Architecture (one paragraph)

A **React + TypeScript frontend** (input, dashboard, recommendations) talks to a
thin **Express backend** that owns the Gemini key. A pure **rules + analytics
engine** (`src/lib/carbon.ts`, `src/lib/footprint.ts`) does all emissions scoring,
category breakdown, and impact/effort ranking. An **LLM layer**
(`src/lib/insights.ts`, `src/lib/chat.ts`) handles explanation, personalization,
and next-step guidance. **Firebase Auth + Firestore** store the user profile and
activity history. If the AI is unavailable, deterministic fallbacks keep every
feature working.

```
Frontend (React)
   │  user actions + profile
   ▼
Express API  ──►  Rules + Analytics engine   (scoring, top-driver, ranking)
   │              carbon.ts · footprint.ts
   ▼
LLM layer (Gemini)  ──►  insights.ts (JSON coach) · chat.ts (assistant)
   │  validated + re-ranked output
   ▼
Firestore (profile + activity history)
```

## 5. Logic Flow

1. User logs an action (challenge, custom offset, or simulated device event).
2. `carbon.ts` computes points, streak, and CO₂ saved; the entry is written to the
   Firestore activity ledger.
3. `footprint.ts` aggregates the ledger into a **category breakdown** and finds the
   **top emission driver** plus untapped categories.
4. `insights.ts` builds a CO-STAR prompt that includes that precomputed analysis;
   Gemini returns a review + 3 candidate actions as strict JSON.
5. The server **re-ranks** the actions by impact-per-effort and returns them, so
   the UI's first suggestion is the highest-leverage next step.
6. The user can ask follow-ups in the **conversational assistant** (`chat.ts`),
   grounded in their live stats.

### Core decision logic (pure & unit-tested)

| Concern | Module · function | Rule |
| --- | --- | --- |
| Scoring | `carbon.calculatePoints` | 25 base + 10 per kg CO₂ |
| Streaks | `carbon.nextStreak` | +1 consecutive day, reset after a gap |
| Transport offset | `carbon.calculateTransitSavings` | distance × mode factor vs. ~0.22 kg/km petrol baseline |
| Top driver | `footprint.summarizeByCategory` | aggregates ledger, ranks categories by CO₂ |
| Next best action | `footprint.rankActionsByImpactEffort` | kg saved ÷ effort weight (Free<Low<Medium) |

## 6. Prompt Strategy

Prompts are engineered, not ad-hoc (`src/lib/insights.ts`, `src/lib/chat.ts`):

- **CO-STAR** — every prompt has explicit Context, Objective, Style, Tone,
  Audience, and Response-format sections.
- **Grounded analysis** — the precomputed top-driver/untapped-category summary is
  injected as "ground truth" so advice targets the user's real footprint.
- **Few-shot** — the insights prompt embeds a one-shot JSON exemplar; the chat
  prompt embeds two Q&A exemplars to lock structure and tone.
- **Chain-of-Thought** — the model reasons step-by-step *internally* (read
  analysis → rank by impact/effort → best step first); for the JSON endpoint the
  reasoning is kept **out** of the output to preserve strict format.
- **Strict format + validation** — the insights endpoint must return one raw JSON
  object (exactly 3 actions, enumerated `cost`); the server validates, coerces,
  and re-ranks before the UI sees it.
- **Anti-hallucination** — only validated user stats are passed; the model is told
  never to invent personal data. Verified live: with the transport tracker off,
  the coach recommended *manual* logging instead of a fake auto-feed.

## 7. Assumptions

- IoT devices are **simulated** — no hardware needed. Emission factors
  (~0.22 kg CO₂/km petrol; ~22 kg CO₂/tree/yr) are representative, not certified.
- The leaderboard seeds with sample competitors until real users sync.
- Credential sync is a popup-blocker-resilient fallback to Google sign-in.

## 8. Testing

`npm test` runs **72 unit tests** (Vitest) over the decision logic:

- `carbon.test.ts` — scoring, streaks, offsets, equivalence, edge cases.
- `footprint.test.ts` — category aggregation, top-driver detection, impact/effort
  ranking, focus-summary text.
- `insights.test.ts` — input bounding, CO-STAR/few-shot/CoT prompt structure,
  footprint injection, defensive JSON parsing, **action re-ranking**, fallback.
- `chat.test.ts` — history validation, prompt grounding, content mapping,
  keyword fallback.

## 9. How to Run

**Prerequisites:** Node.js 18+.

```bash
npm install                       # install deps
cp .env.example .env.local        # then set GEMINI_API_KEY in .env.local (gitignored)
npm run dev                       # full-stack dev server on http://localhost:3000
```

```bash
npm test       # unit tests (Vitest)
npm run lint   # type-check (tsc --noEmit)
npm run build  # production build (client bundle + server.cjs)
npm start      # serve the production build
```

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
  bodies are size-limited and every field validated before prompting; Firestore
  uses default-deny, owner-only, schema-validated, immutable-log rules; model
  output is parsed defensively and never executed.
- **Accessibility:** skip link, semantic landmarks, `aria-label`s on icon buttons,
  `role="tab"`/`aria-selected` navigation, `aria-live` status regions, labeled
  inputs. (Full WCAG sign-off needs manual assistive-tech testing.)

## 11. Future Improvements

- Persist AI recommendations and track "action taken → CO₂ saved" over time.
- Location- and budget-aware factors (regional grid mix, local transit options).
- Weekly goal engine that adapts targets from trend detection.

---

### Efficiency notes

Vendor libraries are split into cacheable chunks (`manualChunks`), keeping the main
bundle ~265 kB. Logs sent to the model are capped (`MAX_RECENT_LOGS`); analytics
run as O(n) passes over the activity log.
