import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize the standard @google/genai SDK with server key and user-agent header
const apiKey = process.env.GEMINI_API_KEY;
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
  console.warn("GEMINI_API_KEY is not defined in the environment. AI insights will fallback to rule-based generation.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint: Generate Personalized Carbon Insights using Gemini 3.5 Flash
  app.post("/api/insights", async (req, res) => {
    try {
      const { userProfile, recentLogs, simulatedSensors } = req.body;

      if (!ai) {
        // Fallback robust engine if API key is missing
        return res.json({
          insights: "### Welcome to your Eco-Action Dashboard!\n\nEnable your **Smart Utility Meter** and **Transport Tracker** to start collecting autonomous telemetry. Based on your current activities, here are your strategic optimizations:\n\n1. **Shift Energy Heavy Operations**: Do laundry or run dishwashers during off-peak solar hours (10 AM - 2 PM) to utilize clean regional power.\n2. **Active Travel Incentives**: You gain an extra +50 points multiplier for cycles or walks registered via the travel simulator. \n3. **Dietary Reduction**: Restricting beef intake to once a week can save up to 45 kg of CO2 per month!",
          actions: [
            { id: "opt_peak", text: "Run laundry during high solar solar yield hours (10am - 2pm)", savedKg: 1.2, cost: "Free" },
            { id: "opt_bike", text: "Commute via cycle simulation twice a week", savedKg: 4.8, cost: "Free" },
            { id: "opt_diet", text: "Adopt 'Meatless Mondays' meal planning", savedKg: 3.5, cost: "Low" }
          ]
        });
      }

      const prompt = `
      You are an expert AI Carbon Reduction Coach. Analyze the user's carbon footprint profile and telemetry to generate tailored, highly actionable and gamified green insights.
      
      User Profile:
      - Display Name: ${userProfile?.name || "Eco Citizen"}
      - Current Points: ${userProfile?.points || 0}
      - Total Carbon Saved: ${userProfile?.totalSavedKg || 0} kg CO2
      - Active Daily Streak: ${userProfile?.streakDays || 0} days
      - Smart Home Utility Meter Integrated: ${userProfile?.smartMeterConnected ? "YES" : "NO"}
      - Transport Activity Tracker Integrated: ${userProfile?.transportTrackerConnected ? "YES" : "NO"}

      Recent Eco Log activities:
      ${JSON.stringify(recentLogs || [], null, 2)}

      Simulated Connected Devices Realtime Feed:
      - Smart Utility Meter: Energy demand reductions of ${simulatedSensors?.meterSaving || 0} kWh.
      - Transportation Tracker: Low carbon voyages logged (${simulatedSensors?.trackerMiles || 0} km of active public/micro-mobility transit).

      Please respond with a JSON object containing:
      1. "insights": A beautifully written Markdown string explaining their performance, praising their active streak, providing three highly creative carbon reduction hacks tailored to their settings, and outlining how they can beat their fellow leaderboard competitors.
      2. "actions": An array of 3 concrete suggested challenge actions. Each item is an object with fields: "id" (string), "text" (string), "savedKg" (number), "cost" ("Free" | "Low" | "Medium").

      Make the tone highly engaging, environmental, upbeat, and gamified. Do not use markdown backticks around the json, return a clean raw json parseable object.
      `;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });

        const textOutput = response.text || "{}";
        const parsed = JSON.parse(textOutput);
        res.json(parsed);
      } catch (genError) {
        console.error("Gemini Generation Error:", genError);
        // Clean elegant fallback
        res.json({
          insights: `### Magnificent work, ${userProfile?.name}! \n\nYour active streak is **${userProfile?.streakDays || 0} days**. \n\n* **Smart Grid Tip**: Your smart meter is tracking automated household carbon offset. Keep appliances off standby! \n* **Active Travel Tip**: Switch short trips to walking for an instant +10 XP bounty. \n* **Diet Tip**: Adding plant-based milk to your coffee can save 0.5kg CO2 daily!`,
          actions: [
            { id: "fallback_appliances", text: "Power down peripheral home accessories overnight", savedKg: 0.8, cost: "Free" },
            { id: "fallback_local", text: "Source food ingredients within a 50-mile radius", savedKg: 1.5, cost: "Low" },
            { id: "fallback_cycle", text: "Simulate a transit tracker cycle tour to earn badges", savedKg: 3.2, cost: "Free" }
          ]
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate dynamic carbon insights." });
    }
  });

  // Handle Vite middleware inside development environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets compiled under /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK CONTAINER] Carbon Footprint App running on port http://0.0.0.0:${PORT}`);
  });
}

startServer();
