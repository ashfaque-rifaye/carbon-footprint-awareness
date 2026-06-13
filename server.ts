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
const GEMINI_MODEL = "gemini-3.5-flash";
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Bound request body size to limit abuse of the public endpoint.
  app.use(express.json({ limit: "64kb" }));

  // Lightweight health check for container/orchestration probes.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", aiEnabled: Boolean(ai) });
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
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
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
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
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
