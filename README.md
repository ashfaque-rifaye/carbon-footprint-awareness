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
- **Eco Assistant (conversational AI)** — A multi-turn chat coach backed by the
  Gemini `/api/chat` endpoint. It is grounded in the user's profile (streak,
  savings, connected devices) and also available as a no-sign-up live demo on the
  landing page.
- **Standings & Badges** — A real-time community leaderboard, achievement
  milestones, and social sharing to drive friendly competition.

### Where AI is used

| Surface | Endpoint | What Gemini does |
| --- | --- | --- |
| Smart AI Coach | `POST /api/insights` | Generates a personalized Markdown report + 3 claimable challenge actions as structured JSON |
| Eco Assistant | `POST /api/chat` | Multi-turn conversational coaching grounded in the user's stats, with rough CO₂ estimates |

Both endpoints validate and bound untrusted input, parse model output defensively,
and degrade to deterministic rule-based responses if the API key is missing or a
call fails — so the experience never breaks.

### Prompt engineering strategy

Both prompts are deliberately engineered rather than ad-hoc, which is what keeps
the assistant accurate, consistently formatted, and free of hallucinated user
data. See [`src/lib/insights.ts`](src/lib/insights.ts) and
[`src/lib/chat.ts`](src/lib/chat.ts).

- **CO-STAR framework** — every prompt is structured into explicit
  **C**ontext, **O**bjective, **S**tyle, **T**one, **A**udience, and
  **R**esponse-format sections, so the model always knows the situation, the goal,
  the voice, the reader, and the exact output shape.
- **Few-shot examples** — the insights prompt embeds a one-shot example of the
  exact JSON schema; the chat system prompt embeds two Q&A examples. This locks in
  structure and tone.
- **Chain-of-Thought (CoT)** — both prompts instruct the model to reason
  step-by-step *internally* (gauge progress → check devices/logs → find gaps →
  derive actions). For the JSON endpoint the reasoning is explicitly kept **out**
  of the output to preserve strict format compliance.
- **Strict output format** — the insights endpoint demands a single raw JSON
  object (no code fences, exactly 3 actions, enumerated `cost` values), and the
  response is then validated/coerced in code before it reaches the UI.
- **Anti-hallucination grounding** — prompts pass only the user's real, validated
  stats and instruct the model to never invent personal data and to say so when a
  value is missing. Verified live: with the transport tracker off, the coach
  suggested *manual* logging instead of claiming an automatic feed.

### Architecture

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, Framer Motion.
- **Backend:** Express server (`server.ts`) that owns the Gemini API key and
  exposes `/api/insights` (AI coaching), `/api/chat` (conversational assistant),
  and `/api/health`. The route handlers are thin — prompt building, response
  parsing, input validation, and fallbacks live in the testable
  [`src/lib/insights.ts`](src/lib/insights.ts) and [`src/lib/chat.ts`](src/lib/chat.ts)
  modules. The key is **never** shipped to the browser.
- **Data:** Firebase Auth + Cloud Firestore, locked down by `firestore.rules`
  (default-deny, per-owner ownership checks, schema validation, immutable logs).
- **AI:** `@google/genai` SDK calling `gemini-3.5-flash` with a structured JSON
  response, validated and coerced before use, plus a rule-based fallback.

### Efficiency

- Vendor libraries (React, Firebase, Motion) are split into separate cacheable
  chunks via `manualChunks`, keeping the main app bundle small (~265 kB vs.
  ~870 kB unsplit) and improving repeat-load performance.
- Recent activity logs sent to the model are capped (`MAX_RECENT_LOGS`) to bound
  token usage, and the request body is size-limited server-side.

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

Decision logic is covered by unit tests run with `npm test` (Vitest, 58 tests):

- [`src/lib/carbon.test.ts`](src/lib/carbon.test.ts) — scoring, streak progression
  and resets, transit/smart-meter offsets, tree-equivalence framing, and edge
  cases (negative, zero, non-finite inputs).
- [`src/lib/insights.test.ts`](src/lib/insights.test.ts) — request normalization
  and input bounding, prompt construction, robust parsing of model output
  (including code-fence stripping and malformed payloads), and the deterministic
  fallback.
- [`src/lib/chat.test.ts`](src/lib/chat.test.ts) — chat history validation and
  bounding, system-prompt grounding, CO-STAR/CoT/few-shot prompt structure,
  Gemini content mapping, and keyword-based fallback replies.

---

## 6. Security

- The Gemini API key is read server-side only from `.env.local`, which is excluded
  by `.gitignore` — no secret is committed or exposed to the client.
- All AI calls are proxied through the Express `/api/insights` endpoint.
- Incoming request bodies are size-limited (64 kb) and every field is validated
  and bounded before being interpolated into the model prompt.
- Firestore access is governed by least-privilege rules: default-deny, owner-only
  writes, schema validation, and immutable audit logs.
- All external/model output is parsed defensively, validated, and rendered as
  text/markdown, never executed.

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
