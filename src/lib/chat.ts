/**
 * Chat module — pure helpers for the conversational "Eco Assistant".
 *
 * The Express server delegates system-prompt construction, message validation,
 * and deterministic fallbacks here so the assistant is testable in isolation and
 * the route handler stays thin.
 */

export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

export interface ChatContextProfile {
  name?: string;
  points?: number;
  totalSavedKg?: number;
  streakDays?: number;
  smartMeterConnected?: boolean;
  transportTrackerConnected?: boolean;
}

/** Maximum number of prior turns forwarded to the model (bounds token usage). */
export const MAX_CHAT_HISTORY = 12;

/** Maximum characters accepted for a single message. */
export const MAX_MESSAGE_LEN = 1000;

function safeText(value: unknown, fallback: string, maxLen: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Validate and bound an incoming chat history. Drops malformed entries, coerces
 * roles, trims long messages, and keeps only the most recent turns.
 */
export function normalizeChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const cleaned: ChatMessage[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const text = safeText(e.text, "", MAX_MESSAGE_LEN);
    if (!text) continue;
    const role: ChatRole = e.role === "model" ? "model" : "user";
    cleaned.push({ role, text });
  }
  return cleaned.slice(-MAX_CHAT_HISTORY);
}

/** Normalize the user profile context used to ground the assistant's answers. */
export function normalizeChatProfile(profile?: ChatContextProfile): Required<ChatContextProfile> {
  const p = profile ?? {};
  return {
    name: safeText(p.name, "there", 60),
    points: safeNumber(p.points),
    totalSavedKg: safeNumber(p.totalSavedKg),
    streakDays: safeNumber(p.streakDays),
    smartMeterConnected: Boolean(p.smartMeterConnected),
    transportTrackerConnected: Boolean(p.transportTrackerConnected),
  };
}

/**
 * Build the system instruction that defines the assistant's persona, scope, and
 * grounding context.
 *
 * Engineered with the CO-STAR framework (Context, Objective, Style, Tone,
 * Audience, Response format), two few-shot Q&A examples for consistent
 * structure, and an explicit chain-of-thought instruction (reasoning done
 * silently so only the final answer is shown). Grounding it in sustainability and
 * the supplied user data prevents off-topic drift and hallucinated personal data.
 */
export function buildChatSystemPrompt(profile: Required<ChatContextProfile>): string {
  return `
# CONTEXT
You are "Eco Assistant", the conversational carbon-footprint coach inside the CarbonSync app, which helps individuals understand, track, and reduce their personal carbon footprint. You are talking with one user whose live stats are provided below. Reliable facts you may use: a petrol car emits ~0.22 kg CO2/km; a short-haul flight emits far more per km than a train; red meat is the most carbon-intensive common food; shifting electricity use to peak-solar daylight hours lowers grid emissions.

# OBJECTIVE
Answer the user's questions and help them take concrete, realistic steps to cut their carbon footprint across energy, transport, diet, and waste. When relevant, give an approximate CO2 figure and tie advice back to their own stats.

# STYLE
Practical and specific. Prefer named actions with rough CO2 estimates over generalities. Use the user's real numbers when they help motivate.

# TONE
Warm, encouraging, and non-judgmental — a supportive coach, never preachy.

# AUDIENCE
An everyday person (not a climate scientist) who wants clear, doable guidance.

# REASONING
Think step by step internally before answering: identify the category of the question, recall the relevant emission facts, factor in the user's context, then write a tight answer. Do NOT print your reasoning — show only the final answer.

# RESPONSE FORMAT
Reply in clean Markdown: at most 2–4 short paragraphs OR a tight bullet list. Bold key actions and figures. Label any CO2 number as approximate (e.g. "~2.2 kg CO₂"). Stay strictly on sustainability and carbon reduction; if asked something unrelated, briefly and kindly redirect to footprint topics. Never invent the user's personal data — use only the context below; if a needed value is missing, say so.

# USER CONTEXT (may be partial)
- Name: ${profile.name}
- Eco points: ${profile.points}
- Total CO2 saved: ${profile.totalSavedKg} kg
- Active streak: ${profile.streakDays} days
- Smart meter connected: ${profile.smartMeterConnected ? "yes" : "no"}
- Transport tracker connected: ${profile.transportTrackerConnected ? "yes" : "no"}

# EXAMPLES (style and structure to imitate)
Example 1
User: "Is it better to take the train or fly for a 500 km trip?"
Assistant: "Great question — the train wins by a wide margin. A 500 km short-haul flight emits roughly **~120 kg CO₂** per passenger, while the same trip by train is often **~15–30 kg CO₂** — up to 80% less. If train is an option, it's one of the highest-impact swaps you can make. Want me to log a low-carbon trip for you?"

Example 2
User: "How do I lower my electricity emissions at home?"
Assistant: "A few high-impact moves:\\n\\n* **Shift heavy loads to daylight:** running laundry/dishwasher midday taps cleaner solar grid power.\\n* **Kill standby drain:** unplugging idle electronics can save **~0.8 kg CO₂/day**.\\n* **Ease heating/cooling:** 1°C less heating trims a meaningful slice off your bill and footprint.\\n\\nYour smart meter can auto-log some of these savings."
`.trim();
}

/**
 * Map normalized chat history into the @google/genai "contents" format
 * (role + parts). Model messages map to the "model" role; everything else to
 * "user".
 */
export function toGeminiContents(messages: ChatMessage[]): Array<{ role: ChatRole; parts: Array<{ text: string }> }> {
  return messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
}

/** Lower-cased keyword buckets for the offline rule-based fallback. */
const FALLBACK_RULES: Array<{ keywords: string[]; reply: string }> = [
  {
    keywords: ["car", "drive", "commute", "fuel", "petrol", "gas", "travel", "flight", "fly"],
    reply:
      "Transport is often the biggest personal source of emissions. A petrol car emits roughly **0.22 kg CO₂ per km**, so swapping short trips for walking, cycling, or public transit adds up fast. For longer journeys, trains beat flights by a wide margin. Try logging a low-carbon trip in the **Transport Tracker** to see your savings.",
  },
  {
    keywords: ["energy", "electricity", "power", "solar", "heating", "appliance", "home"],
    reply:
      "Home energy is a great place to cut carbon. Shift heavy appliance use (laundry, dishwasher) to daylight hours when the grid is cleaner, unplug standby 'vampire' loads, and lower heating by a degree or two. If you have the **Smart Utility Meter** connected, it logs solar offsets automatically.",
  },
  {
    keywords: ["food", "diet", "meat", "beef", "vegan", "vegetarian", "eat"],
    reply:
      "Diet is a quietly powerful lever. Red meat is the most carbon-intensive food, so even one or two plant-based days a week makes a real dent — a 'Meatless Monday' can save around **3.5 kg CO₂ per week**. Buying local and seasonal, and cutting food waste, help too.",
  },
  {
    keywords: ["waste", "recycle", "plastic", "compost", "trash"],
    reply:
      "Reducing waste keeps carbon out of landfills. Composting food scraps, recycling properly, and choosing reusable over single-use items all help. Planning meals to avoid throwing away food is one of the highest-impact habits.",
  },
];

/**
 * Deterministic, rule-based reply used when the AI key is missing or the model
 * call fails. Picks the most relevant tip based on simple keyword matching so the
 * assistant still gives useful, on-topic guidance.
 */
export function fallbackChatReply(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.text || "").toLowerCase();

  for (const rule of FALLBACK_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return rule.reply;
    }
  }

  return [
    "Here are a few high-impact ways to shrink your carbon footprint:",
    "- **Transport:** walk, cycle, or take transit for short trips; favour trains over flights.",
    "- **Energy:** run appliances in daylight, unplug standby loads, and dial heating down a notch.",
    "- **Diet:** add a couple of plant-based days each week and cut food waste.",
    "",
    "Ask me about any of these and I'll go deeper. (AI service is offline right now, so this is a built-in tip.)",
  ].join("\n");
}
