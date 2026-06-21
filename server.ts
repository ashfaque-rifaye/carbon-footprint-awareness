import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import {
  normalizeInsightsRequest,
  buildInsightsPrompt,
  parseInsightsResponse,
  fallbackInsights,
} from "./src/lib/insights";
import {
  normalizeChatMessages,
  normalizeChatProfile,
  buildChatSystemPrompt,
  toGeminiContents,
  fallbackChatReply,
} from "./src/lib/chat";
import { createStore, toProfile, EmailTakenError, type UserRow } from "./src/lib/db";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  validateRegistration,
  validateLogin,
} from "./src/lib/auth";
import {
  calculatePoints,
  roundKg,
  nextStreak,
  resolveStreakOnLogin,
  toDateKey,
} from "./src/lib/carbon";
import { createRateLimiter } from "./src/lib/rateLimit";
import type { EmissionsLog } from "./src/types";

// Load environment variables. `.env.local` (gitignored, holds secrets) takes
// precedence over a committed `.env`, mirroring Vite/Next conventions.
dotenv.config({ path: ".env.local" });
dotenv.config();

// Initialize the standard @google/genai SDK with server key and user-agent header.
// The key is read server-side only and is never exposed to the browser.
const apiKey = process.env.GEMINI_API_KEY;

// Model selection is env-configurable so the deployment can be retargeted without
// a code change. We attempt the primary model first, then degrade through a stable
// fallback before the rule-based engine takes over. This keeps the AI coach alive
// when the newest model is momentarily overloaded (503 / UNAVAILABLE), instead of
// collapsing straight to templates.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
const MODEL_CHAIN = [...new Set([PRIMARY_MODEL, FALLBACK_MODEL])];

let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn(
    "GEMINI_API_KEY is not defined in the environment. AI insights will fall back to rule-based generation."
  );
}

// Run a generateContent request across the model chain. Each model is tried in
// order; a transient error (e.g. an overloaded 503 model) advances to the next.
// Throws only if every model fails, letting the caller fall back to rule-based
// generation. Assumes `ai` is non-null (callers guard on it).
async function generateWithFallback(params: {
  contents: unknown;
  config?: Record<string, unknown>;
}): Promise<{ text?: string }> {
  let lastError: unknown;
  for (const model of MODEL_CHAIN) {
    try {
      return await ai!.models.generateContent({
        model,
        contents: params.contents as never,
        config: params.config as never,
      });
    } catch (err) {
      lastError = err;
      console.warn(`Gemini model "${model}" failed; trying next in chain.`, err);
    }
  }
  throw lastError;
}

// Local SQLite store (accounts, activity ledger, sessions). No external/cloud DB.
// On Cloud Run set DB_PATH to a writable path (e.g. /tmp/carbonsync.db); locally
// it defaults to ./data/carbonsync.db.
const DB_PATH = process.env.DB_PATH || "data/carbonsync.db";
const store = createStore(DB_PATH);

const SESSION_COOKIE = "cs_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const VALID_CATEGORIES = new Set(["transport", "energy", "diet", "waste"]);
const VALID_SOURCES = new Set(["manual", "smart_meter", "transport_tracker"]);
const VALID_AVATARS = new Set(["sprout", "globe", "leaf", "bike"]);

// Minimal cookie-header parser (avoids a cookie-parser dependency).
function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

// Throttle the public auth endpoints against brute-force / spam (per client IP).
const authLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

// Best-effort client IP behind Cloud Run's proxy.
function clientIp(req: express.Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

// Resolve the authenticated user from the session cookie, or undefined.
function getSessionUser(req: express.Request): UserRow | undefined {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  return token ? store.getUserBySession(token) : undefined;
}

function setSessionCookie(res: express.Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Baseline HTTP security headers (dependency-free; safe for this SPA).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    next();
  });

  // Bound request body size to limit abuse of the public endpoint.
  app.use(express.json({ limit: "64kb" }));

  // Rate-limit the unauthenticated auth endpoints.
  app.use(["/api/auth/login", "/api/auth/register"], (req, res, next) => {
    if (!authLimiter.check(clientIp(req))) {
      return res.status(429).json({ error: "Too many attempts. Please try again in a minute." });
    }
    return next();
  });

  // Lightweight health check for container/orchestration probes.
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      aiEnabled: Boolean(ai),
      models: ai ? MODEL_CHAIN : [],
    });
  });

  // ---- Authentication ------------------------------------------------------

  // Register a new account (name + email + password), then start a session.
  app.post("/api/auth/register", (req, res) => {
    const result = validateRegistration(req.body);
    if (!result.ok || !result.value) {
      return res.status(400).json({ error: result.error });
    }
    const { name, email, password } = result.value;
    const avatar = VALID_AVATARS.has(req.body?.avatar) ? req.body.avatar : "sprout";

    try {
      const { hash, salt } = hashPassword(password);
      const row = store.createUser({
        name,
        email,
        passwordHash: hash,
        salt,
        avatar,
        today: toDateKey(),
      });
      const token = generateSessionToken();
      store.createSession(row.id, token);
      setSessionCookie(res, token);
      return res.status(201).json({ profile: toProfile(row) });
    } catch (err) {
      if (err instanceof EmailTakenError) {
        return res.status(409).json({ error: err.message });
      }
      console.error("Register error:", err);
      return res.status(500).json({ error: "Could not create the account." });
    }
  });

  // Log in with email + password; refreshes the streak on a new day.
  app.post("/api/auth/login", (req, res) => {
    const result = validateLogin(req.body);
    if (!result.ok || !result.value) {
      return res.status(400).json({ error: result.error });
    }
    const { email, password } = result.value;
    const row = store.getUserByEmail(email);
    // Verify even when the user is missing would be ideal for timing; we keep a
    // generic message either way so accounts can't be enumerated.
    if (!row || !verifyPassword(password, row.password_hash, row.salt)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Recompute streak validity at login time.
    const today = toDateKey();
    const validated = resolveStreakOnLogin(row.streak_days, row.last_active_date, today);
    if (validated !== row.streak_days) {
      store.updateStreak(row.id, validated, today);
      row.streak_days = validated;
      row.last_active_date = today;
    }

    const token = generateSessionToken();
    store.createSession(row.id, token);
    setSessionCookie(res, token);
    return res.json({ profile: toProfile(row) });
  });

  // End the current session.
  app.post("/api/auth/logout", (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) store.deleteSession(token);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return res.json({ ok: true });
  });

  // Return the signed-in profile (used to restore a session on page load).
  app.get("/api/auth/me", (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    return res.json({ profile: toProfile(user) });
  });

  // ---- Activity ledger -----------------------------------------------------

  // List the signed-in user's carbon activity log (newest first).
  app.get("/api/logs", (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    return res.json({ logs: store.listLogs(user.id) });
  });

  // Record a carbon-saving activity. Scoring is computed server-side (authoritative).
  app.post("/api/logs", (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated." });

    const body = req.body ?? {};
    const activityName =
      typeof body.activityName === "string" ? body.activityName.trim().slice(0, 120) : "";
    const category = body.category;
    const source = VALID_SOURCES.has(body.source) ? body.source : "manual";
    const kgSaved = Number(body.kgSaved);

    if (!activityName) return res.status(400).json({ error: "Activity name is required." });
    if (!VALID_CATEGORIES.has(category))
      return res.status(400).json({ error: "Invalid category." });
    if (!Number.isFinite(kgSaved) || kgSaved <= 0 || kgSaved > 1000) {
      return res.status(400).json({ error: "kgSaved must be between 0 and 1000." });
    }

    const today = toDateKey();
    const pointsAwarded = calculatePoints(kgSaved);
    const updatedPoints = user.points + pointsAwarded;
    const updatedSaved = roundKg(user.total_saved_kg + kgSaved);
    const updatedStreak = nextStreak(user.streak_days, user.last_active_date, today);

    const log: EmissionsLog = {
      logId: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      category,
      kgSaved: roundKg(kgSaved),
      activityName,
      timestamp: new Date().toISOString(),
      source,
    };

    // Write the log and updated stats atomically.
    store.raw.transaction(() => {
      store.insertLog(log);
      store.updateStats(user.id, {
        points: updatedPoints,
        totalSavedKg: updatedSaved,
        streakDays: updatedStreak,
        lastActiveDate: today,
      });
    })();

    const refreshed = store.getUserById(user.id)!;
    return res.status(201).json({
      profile: toProfile(refreshed),
      log,
      pointsAwarded,
    });
  });

  // Delete a single activity log entry the user owns.
  app.delete("/api/logs/:logId", (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated." });
    const removed = store.deleteLog(user.id, req.params.logId);
    if (!removed) return res.status(404).json({ error: "Log entry not found." });
    return res.json({ ok: true });
  });

  // ---- Profile + leaderboard ----------------------------------------------

  // Update mutable profile fields (device toggles, avatar, display name).
  app.patch("/api/profile", (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated." });

    const body = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof body.smartMeterConnected === "boolean")
      patch.smartMeterConnected = body.smartMeterConnected;
    if (typeof body.transportTrackerConnected === "boolean")
      patch.transportTrackerConnected = body.transportTrackerConnected;
    if (typeof body.name === "string" && body.name.trim())
      patch.name = body.name.trim().slice(0, 60);
    if (typeof body.avatar === "string" && VALID_AVATARS.has(body.avatar))
      patch.avatar = body.avatar;

    const updated = store.updateProfile(user.id, patch);
    return res.json({ profile: toProfile(updated!) });
  });

  // Public top standings (seeded with sample competitors for a lively board).
  app.get("/api/leaderboard", (_req, res) => {
    const real = store.topLeaderboard(12);
    const seeded = [
      {
        userId: "seed_1",
        name: "Helena BioShield",
        points: 3420,
        totalSavedKg: 91.2,
        avatar: "leaf",
      },
      {
        userId: "seed_2",
        name: "Arthur WindPower",
        points: 2150,
        totalSavedKg: 58.4,
        avatar: "globe",
      },
      {
        userId: "seed_3",
        name: "Chloe CycleFast",
        points: 1280,
        totalSavedKg: 34.1,
        avatar: "bike",
      },
    ];
    // Merge real users with seeds, dedupe by id, sort by points, cap at 12.
    const merged = [...real, ...seeded]
      .filter((entry, i, arr) => arr.findIndex((e) => e.userId === entry.userId) === i)
      .sort((a, b) => b.points - a.points)
      .slice(0, 12);
    return res.json({ leaderboard: merged });
  });

  // API endpoint: Generate personalized carbon insights using Gemini.
  app.post("/api/insights", async (req, res) => {
    // Validate and normalize untrusted client input before use.
    const ctx = normalizeInsightsRequest(req.body);

    // No API key configured: serve the deterministic rule-based engine.
    if (!ai) {
      return res.json(fallbackInsights(ctx.userProfile));
    }

    try {
      const response = await generateWithFallback({
        contents: buildInsightsPrompt(ctx),
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = parseInsightsResponse(response.text);
      // If the model returns malformed output, degrade gracefully.
      return res.json(parsed ?? fallbackInsights(ctx.userProfile));
    } catch (genError) {
      console.error("Gemini generation error:", genError);
      return res.json(fallbackInsights(ctx.userProfile));
    }
  });

  // API endpoint: Conversational Eco Assistant (multi-turn chat).
  app.post("/api/chat", async (req, res) => {
    const messages = normalizeChatMessages(req.body?.messages);
    const profile = normalizeChatProfile(req.body?.userProfile);

    if (messages.length === 0) {
      return res.status(400).json({ error: "At least one message is required." });
    }

    // No API key configured: serve the deterministic rule-based assistant.
    if (!ai) {
      return res.json({ reply: fallbackChatReply(messages), source: "fallback" });
    }

    try {
      const response = await generateWithFallback({
        contents: toGeminiContents(messages),
        config: {
          systemInstruction: buildChatSystemPrompt(profile),
        },
      });

      const reply = (response.text || "").trim();
      if (!reply) {
        return res.json({ reply: fallbackChatReply(messages), source: "fallback" });
      }
      return res.json({ reply, source: "ai" });
    } catch (chatError) {
      console.error("Gemini chat error:", chatError);
      return res.json({ reply: fallbackChatReply(messages), source: "fallback" });
    }
  });

  // Handle Vite middleware inside the development environment.
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets compiled under /dist.
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK CONTAINER] Carbon Footprint App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
