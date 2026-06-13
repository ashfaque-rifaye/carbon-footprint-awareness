# 🌱 CarbonSync — AI-Powered Carbon Footprint Awareness Assistant

CarbonSync is a gamified, real-time carbon footprint tracking platform that helps
everyday "green citizens" understand, log, and reduce their personal emissions.
It pairs simulated IoT telemetry (a smart utility meter and a multi-modal transport
tracker) with a **Gemini-powered AI Carbon Coach** that turns each user's activity
into tailored, actionable advice.

> Built for **PromptWars — Challenge 3** around the **Sustainability / Carbon
> Footprint Awareness** vertical.

---

## 1. Chosen Vertical & Persona

**Vertical:** Sustainability — Carbon Footprint Awareness.

**Persona:** *Maya, an environmentally-conscious city dweller.* She wants to lower
her footprint but finds most carbon calculators static, guilt-driven, and easy to
abandon. She needs something that (a) makes progress visible, (b) rewards
consistency, and (c) gives concrete next steps based on her actual lifestyle.

CarbonSync is designed around her: it is encouraging rather than punishing,
gamified to build daily habits, and context-aware so the guidance fits what she
actually does.

---

## 2. Approach & Logic

The assistant makes decisions from three context signals and feeds them to Gemini:

1. **User profile** — points, total CO₂ saved, daily streak, and which simulated
   devices are connected.
2. **Recent activity ledger** — the last few logged carbon-saving actions
   (category, kilograms saved, source).
3. **Live simulated telemetry** — smart-meter solar offset and transport-tracker
   low-carbon distance.

These are combined into a structured prompt. Gemini returns a JSON payload with
(a) a personalized Markdown coaching narrative and (b) three concrete, claimable
challenge actions sized to the user's situation. If the model or API key is
unavailable, a deterministic rule-based engine produces equivalent guidance so the
experience never breaks.

### Core decision logic (pure & testable)

All carbon math lives in [`src/lib/carbon.ts`](src/lib/carbon.ts) as pure
functions so it can be unit-tested and reused without duplication:

| Concern | Function | Rule |
| --- | --- | --- |
| Scoring | `calculatePoints` | 25 base points + 10 per kg CO₂ saved |
| Streaks | `nextStreak` / `resolveStreakOnLogin` | +1 for consecutive days, reset after a gap |
| Transport offset | `calculateTransitSavings` | distance × mode factor vs. a petrol baseline (~0.22 kg/km) |
| Smart meter | `smartMeterOffset` | rewards solar yield that exceeds household load |
| Impact framing | `treesEquivalent` | converts kg CO₂ into mature-tree absorption |

---

## 3. How the Solution Works

- **Eco Tracker** — Connect the simulated Smart Utility Meter (auto-logs passive
  solar offsets) and Transport Tracker (simulates low-carbon journeys), then claim
  daily challenges or log custom offsets.
- **Carbon Ledger** — An immutable, real-time audit trail of every saving, synced
  to Cloud Firestore.
- **Smart AI Coach** — Calls the Gemini-backed `/api/insights` endpoint to generate
  personalized insights and claimable actions from the user's live context.
- **Standings & Badges** — A real-time community leaderboard, achievement
  milestones, and social sharing to drive friendly competition.

### Architecture

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, Framer Motion.
- **Backend:** Express server (`server.ts`) that owns the Gemini API key and
  exposes a single `/api/insights` endpoint — the key is **never** shipped to the
  browser.
- **Data:** Firebase Auth + Cloud Firestore, locked down by `firestore.rules`
  (default-deny, per-owner ownership checks, schema validation, immutable logs).
- **AI:** `@google/genai` SDK calling `gemini-3.5-flash` with a structured JSON
  response, plus a rule-based fallback.

---

## 4. Running Locally

**Prerequisites:** Node.js 18+.

```bash
# 1. Install dependencies
npm install

# 2. Add your Gemini API key to .env.local (this file is gitignored)
#    GEMINI_API_KEY="your-key-here"
cp .env.example .env.local   # then edit it

# 3. Start the full-stack dev server (Express + Vite) on http://localhost:3000
npm run dev
```

Other scripts:

```bash
npm test        # run the unit test suite (Vitest)
npm run lint    # type-check with tsc --noEmit
npm run build   # production build (client bundle + server.cjs)
npm start       # serve the production build
```

---

## 5. Testing

Carbon decision logic is covered by unit tests in
[`src/lib/carbon.test.ts`](src/lib/carbon.test.ts) (run with `npm test`). The suite
validates scoring, streak progression and resets, transit/smart-meter offsets,
tree-equivalence framing, and edge cases (negative, zero, and non-finite inputs).

---

## 6. Security

- The Gemini API key is read server-side only from `.env.local`, which is excluded
  by `.gitignore` — no secret is committed or exposed to the client.
- All AI calls are proxied through the Express `/api/insights` endpoint.
- Firestore access is governed by least-privilege rules: default-deny, owner-only
  writes, schema validation, and immutable audit logs.
- All external/model output is treated as untrusted and rendered as text/markdown,
  never executed.

---

## 7. Accessibility

- A "Skip to main content" link and semantic landmarks (`<header>`, `<main>`,
  `<footer>`).
- Icon-only controls expose descriptive `aria-label`s; decorative icons are marked
  `aria-hidden`.
- Tab navigation uses `role="tablist"` / `role="tab"` with `aria-selected`.
- Status banners use `aria-live` so updates are announced to screen readers.
- Form inputs have associated labels.

> Note: Full WCAG conformance requires manual testing with assistive technologies
> and expert review; the above covers the primary programmatic criteria.

---

## 8. Assumptions

- IoT devices are **simulated** — no physical hardware is required. Telemetry uses
  representative emission factors (e.g., ~0.22 kg CO₂/km petrol baseline) for
  illustration, not certified accounting.
- Emission factors are approximate and chosen for clarity and engagement.
- "Trees equivalent" uses ~22 kg CO₂ absorbed per mature tree per year.
- The community leaderboard seeds with sample competitors until real users sync.
- Anonymous/credential sync is provided as a popup-blocker-resilient fallback to
  Google federated sign-in.
