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
async function generateWithFallback(
  params: { contents: unknown; config?: Record<string, unknown> }
): Promise<{ text?: string }> {
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Bound request body size to limit abuse of the public endpoint.
  app.use(express.json({ limit: "64kb" }));

  // Lightweight health check for container/orchestration probes.
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      aiEnabled: Boolean(ai),
      models: ai ? MODEL_CHAIN : [],
    });
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
      res.json(parsed ?? fallbackInsights(ctx.userProfile));
    } catch (genError) {
      console.error("Gemini generation error:", genError);
      res.json(fallbackInsights(ctx.userProfile));
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
      res.json({ reply, source: "ai" });
    } catch (chatError) {
      console.error("Gemini chat error:", chatError);
      res.json({ reply: fallbackChatReply(messages), source: "fallback" });
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
