/**
 * Insights module — pure helpers for the AI Carbon Coach endpoint.
 *
 * The Express server delegates prompt construction, response parsing, request
 * validation, and deterministic fallbacks here so the AI behavior is testable in
 * isolation and the route handler stays thin.
 */

import { summarizeByCategory, buildFocusSummary, rankActionsByImpactEffort } from "./footprint";
import type { EmissionsLog } from "../types";

export type ActionCost = "Free" | "Low" | "Medium";

export interface SuggestedAction {
  id: string;
  text: string;
  savedKg: number;
  cost: ActionCost;
}

export interface InsightsResult {
  insights: string;
  actions: SuggestedAction[];
}

export interface InsightsContextProfile {
  name?: string;
  points?: number;
  totalSavedKg?: number;
  streakDays?: number;
  smartMeterConnected?: boolean;
  transportTrackerConnected?: boolean;
}

export interface InsightsSensors {
  meterSaving?: number;
  trackerMiles?: number;
}

export interface InsightsRequest {
  userProfile?: InsightsContextProfile;
  recentLogs?: unknown[];
  simulatedSensors?: InsightsSensors;
}

/** A fully-resolved insights context (every field populated with a safe value). */
export interface NormalizedInsightsContext {
  userProfile: Required<InsightsContextProfile>;
  recentLogs: unknown[];
  simulatedSensors: Required<InsightsSensors>;
}

/** Cap how many recent logs we forward to the model to bound token usage. */
export const MAX_RECENT_LOGS = 5;

/** Coerce an unknown value into a safe display string of bounded length. */
function safeText(value: unknown, fallback: string, maxLen = 120): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

/** Coerce an unknown value into a finite, non-negative number. */
function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Normalize and validate an incoming request body into a safe context object.
 * Untrusted client input is bounded and type-checked before it is interpolated
 * into the model prompt.
 */
export function normalizeInsightsRequest(body: unknown): NormalizedInsightsContext {
  const raw = (body ?? {}) as InsightsRequest;
  const profile = raw.userProfile ?? {};
  const sensors = raw.simulatedSensors ?? {};
  const logs = Array.isArray(raw.recentLogs) ? raw.recentLogs.slice(0, MAX_RECENT_LOGS) : [];

  return {
    userProfile: {
      name: safeText(profile.name, "Eco Citizen", 60),
      points: safeNumber(profile.points),
      totalSavedKg: safeNumber(profile.totalSavedKg),
      streakDays: safeNumber(profile.streakDays),
      smartMeterConnected: Boolean(profile.smartMeterConnected),
      transportTrackerConnected: Boolean(profile.transportTrackerConnected),
    },
    recentLogs: logs,
    simulatedSensors: {
      meterSaving: safeNumber(sensors.meterSaving),
      trackerMiles: safeNumber(sensors.trackerMiles),
    },
  };
}

/**
 * Build the structured Gemini prompt from a normalized context.
 *
 * The prompt is engineered with the CO-STAR framework (Context, Objective, Style,
 * Tone, Audience, Response format), reinforced with a one-shot example and an
 * explicit chain-of-thought instruction. CoT reasoning is performed INTERNALLY so
 * that the response stays a single clean JSON object (strict format compliance).
 */
export function buildInsightsPrompt(ctx: NormalizedInsightsContext): string {
  const { userProfile: p, recentLogs, simulatedSensors: s } = ctx;

  // Derive the user's biggest emission-savings driver and untapped categories so
  // the model targets the real top contributor instead of giving generic tips.
  const focus = buildFocusSummary(summarizeByCategory(recentLogs as EmissionsLog[]));

  // One-shot example: anchors the exact output schema, tone, and value ranges so
  // the model reproduces structure consistently (few-shot prompting).
  const example = {
    insights:
      "### You're on fire, Alex! 🔥\\n\\nYour **3-day streak** and 12.4 kg saved already put you ahead of most newcomers. Here are three tailored hacks:\\n\\n* **Solar Laundry:** Your smart meter is live — run washes at midday to bank free clean-grid offsets.\\n* **Active Commute:** Swap two car trips for cycling to climb past 'Arthur WindPower' on the leaderboard.\\n* **Plant-Forward Lunch:** One meatless lunch a day saves ~1.5 kg CO₂ weekly.",
    actions: [
      { id: "solar_laundry", text: "Run laundry during midday solar peak (11 AM–2 PM)", savedKg: 1.2, cost: "Free" },
      { id: "cycle_commute", text: "Cycle two short commutes this week", savedKg: 4.4, cost: "Free" },
      { id: "meatless_lunch", text: "Have one plant-based lunch daily", savedKg: 1.5, cost: "Low" },
    ],
  };

  return `
# CONTEXT
You are the AI Carbon Reduction Coach inside "CarbonSync", a gamified app that helps individuals understand, track, and reduce their personal carbon footprint. You are given a single user's live profile, their recent eco-action log, and readings from their simulated smart-home and transport devices. Emission facts you may rely on: a petrol car emits ~0.22 kg CO2/km; red meat is the most carbon-intensive common food; shifting grid load to peak-solar hours reduces emissions.

# OBJECTIVE
Identify the user's biggest emission-savings driver and the most relevant untapped areas, then produce a short performance review plus exactly three concrete, claimable next actions — RANKED so the first action is the single best next step (highest CO2 impact for the lowest effort). Tailor every suggestion to the data below — never give generic advice that ignores their context.

# STYLE
Crisp, concrete, and data-aware. Reference the user's real numbers (streak, kg saved, top category, devices). Each tip must name a specific behavior and an approximate CO2 saving. No vague platitudes like "use public transport" — say which trips, how often, and the saving.

# TONE
Upbeat, encouraging, and lightly gamified — like a supportive coach celebrating progress and nudging the next win.

# AUDIENCE
A motivated individual (not a scientist) who wants practical, everyday steps and a bit of friendly competition.

# REASONING (do this silently, internally — DO NOT include it in the output)
Think step by step before writing: (1) read the FOOTPRINT ANALYSIS to find the top driver and untapped categories; (2) gauge the user's progress level from points/streak/savings; (3) note which devices are connected and recent logged categories; (4) for each candidate action estimate CO2 saved and effort (Free<Low<Medium), then rank by impact-per-effort; (5) put the single best next step first; (6) only then compose the final JSON.

# FOOTPRINT ANALYSIS (precomputed from the user's log — treat as ground truth)
${focus}

# USER DATA
Profile:
- Display Name: ${p.name}
- Current Points: ${p.points}
- Total Carbon Saved: ${p.totalSavedKg} kg CO2
- Active Daily Streak: ${p.streakDays} days
- Smart Home Utility Meter Integrated: ${p.smartMeterConnected ? "YES" : "NO"}
- Transport Activity Tracker Integrated: ${p.transportTrackerConnected ? "YES" : "NO"}

Recent Eco Log activities (JSON):
${JSON.stringify(recentLogs, null, 2)}

Simulated device feed:
- Smart Utility Meter: energy demand reductions of ${s.meterSaving} kWh.
- Transport Tracker: ${s.trackerMiles} km of active/low-carbon transit logged.

# RESPONSE FORMAT (STRICT)
Return ONE raw JSON object and NOTHING else — no markdown code fences, no prose before or after. It MUST match this schema exactly:
{
  "insights": string,   // Markdown; 1 short intro line naming the top driver + a 3-bullet list of tailored hacks
  "actions": [          // EXACTLY 3 items, ORDERED best-next-step first
    { "id": string, "text": string, "savedKg": number, "cost": "Free" | "Low" | "Medium" }
  ]
}
Rules: "savedKg" is a positive number (kg CO2). "cost" is exactly one of "Free", "Low", or "Medium". "id" is a short lowercase snake_case slug. Order "actions" by impact-per-effort, best first.

# EXAMPLE (for a different user named Alex — match this structure, not its content)
${JSON.stringify(example)}

Now generate the JSON for the user described in USER DATA.
`.trim();
}

/** Validate that a parsed action has the expected shape, coercing as needed. */
function coerceAction(value: unknown, index: number): SuggestedAction | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  const text = safeText(a.text, "", 200);
  if (!text) return null;
  const cost: ActionCost =
    a.cost === "Low" || a.cost === "Medium" ? a.cost : "Free";
  return {
    id: safeText(a.id, `action_${index}`, 60),
    text,
    savedKg: safeNumber(a.savedKg),
    cost,
  };
}

/**
 * Safely parse the model's raw text into a validated InsightsResult. Strips any
 * accidental markdown code fences and rejects malformed payloads (returns null
 * so the caller can fall back gracefully). Returned actions are re-ranked by
 * impact-per-effort so the "next best action" is always first, regardless of the
 * order the model emitted.
 */
export function parseInsightsResponse(text: string | undefined | null): InsightsResult | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  const insights = typeof obj.insights === "string" ? obj.insights : "";
  if (!insights) return null;

  const rawActions = Array.isArray(obj.actions) ? obj.actions : [];
  const validated = rawActions
    .map((a, i) => coerceAction(a, i))
    .filter((a): a is SuggestedAction => a !== null);

  // Re-rank by impact-per-effort; strip the helper score before returning.
  const actions: SuggestedAction[] = rankActionsByImpactEffort(validated).map(
    ({ impactEffortScore, ...action }) => action
  );

  return { insights, actions };
}

/**
 * Deterministic, rule-based insights used when the AI key is missing or the
 * model call fails. Guarantees the UI always receives useful, personalized
 * guidance so the experience never breaks.
 */
export function fallbackInsights(profile?: InsightsContextProfile): InsightsResult {
  const name = safeText(profile?.name, "Eco Citizen", 60);
  const streak = safeNumber(profile?.streakDays);
  const hasMeter = Boolean(profile?.smartMeterConnected);
  const hasTracker = Boolean(profile?.transportTrackerConnected);

  const meterTip = hasMeter
    ? "Your **Smart Utility Meter** is live — run laundry and dishwashers during peak solar hours (10 AM–2 PM) to bank clean-grid offsets automatically."
    : "Connect your **Smart Utility Meter** to passively earn carbon credits whenever solar output beats household demand.";
  const transitTip = hasTracker
    ? "Your **Transport Tracker** is active — swap short car trips for walking or cycling to rack up high-bounty active-travel offsets."
    : "Enable the **Transport Tracker** and log a cycle or walk to unlock the active-travel points multiplier.";

  return {
    insights: [
      `### Great momentum, ${name}!`,
      `You're on a **${streak}-day** streak — consistency is where real footprint reduction compounds.`,
      `* **Energy:** ${meterTip}`,
      `* **Travel:** ${transitTip}`,
      `* **Diet:** Adopting "Meatless Mondays" can save roughly 3.5 kg CO₂ each week and climb you up the leaderboard.`,
    ].join("\n\n"),
    actions: [
      { id: "fallback_peak_energy", text: "Run laundry during peak solar hours (10 AM–2 PM)", savedKg: 1.2, cost: "Free" },
      { id: "fallback_active_transit", text: "Replace one short car trip with a walk or cycle", savedKg: 3.4, cost: "Free" },
      { id: "fallback_plant_meal", text: "Plan one plant-based dinner this week", savedKg: 2.2, cost: "Low" },
    ],
  };
}
