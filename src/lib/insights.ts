/**
 * Insights module — pure helpers for the AI Carbon Coach endpoint.
 *
 * The Express server delegates prompt construction, response parsing, request
 * validation, and deterministic fallbacks here so the AI behavior is testable in
 * isolation and the route handler stays thin.
 */

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
export function normalizeInsightsRequest(body: unknown): Required<InsightsRequest> {
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

/** Build the structured Gemini prompt from a normalized context. */
export function buildInsightsPrompt(ctx: Required<InsightsRequest>): string {
  const { userProfile: p, recentLogs, simulatedSensors: s } = ctx;
  return `
You are an expert AI Carbon Reduction Coach. Analyze the user's carbon footprint profile and telemetry to generate tailored, highly actionable and gamified green insights.

User Profile:
- Display Name: ${p.name}
- Current Points: ${p.points}
- Total Carbon Saved: ${p.totalSavedKg} kg CO2
- Active Daily Streak: ${p.streakDays} days
- Smart Home Utility Meter Integrated: ${p.smartMeterConnected ? "YES" : "NO"}
- Transport Activity Tracker Integrated: ${p.transportTrackerConnected ? "YES" : "NO"}

Recent Eco Log activities:
${JSON.stringify(recentLogs, null, 2)}

Simulated Connected Devices Realtime Feed:
- Smart Utility Meter: Energy demand reductions of ${s.meterSaving} kWh.
- Transportation Tracker: Low carbon voyages logged (${s.trackerMiles} km of active public/micro-mobility transit).

Please respond with a JSON object containing:
1. "insights": A beautifully written Markdown string explaining their performance, praising their active streak, providing three highly creative carbon reduction hacks tailored to their settings, and outlining how they can beat their fellow leaderboard competitors.
2. "actions": An array of 3 concrete suggested challenge actions. Each item is an object with fields: "id" (string), "text" (string), "savedKg" (number), "cost" ("Free" | "Low" | "Medium").

Make the tone highly engaging, environmental, upbeat, and gamified. Do not use markdown backticks around the json, return a clean raw json parseable object.
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
 * so the caller can fall back gracefully).
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
  const actions = rawActions
    .map((a, i) => coerceAction(a, i))
    .filter((a): a is SuggestedAction => a !== null);

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
