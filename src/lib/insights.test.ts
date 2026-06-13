import { describe, it, expect } from "vitest";
import {
  MAX_RECENT_LOGS,
  normalizeInsightsRequest,
  buildInsightsPrompt,
  parseInsightsResponse,
  fallbackInsights,
} from "./insights";

describe("normalizeInsightsRequest", () => {
  it("fills safe defaults for an empty body", () => {
    const ctx = normalizeInsightsRequest(undefined);
    expect(ctx.userProfile.name).toBe("Eco Citizen");
    expect(ctx.userProfile.points).toBe(0);
    expect(ctx.userProfile.smartMeterConnected).toBe(false);
    expect(ctx.recentLogs).toEqual([]);
    expect(ctx.simulatedSensors.meterSaving).toBe(0);
  });

  it("caps recent logs to the configured maximum", () => {
    const logs = Array.from({ length: 20 }, (_, i) => ({ i }));
    const ctx = normalizeInsightsRequest({ recentLogs: logs });
    expect(ctx.recentLogs).toHaveLength(MAX_RECENT_LOGS);
  });

  it("clamps negative or invalid numbers to zero", () => {
    const ctx = normalizeInsightsRequest({
      userProfile: { points: -50, totalSavedKg: NaN as unknown as number },
    });
    expect(ctx.userProfile.points).toBe(0);
    expect(ctx.userProfile.totalSavedKg).toBe(0);
  });

  it("bounds an excessively long display name", () => {
    const ctx = normalizeInsightsRequest({ userProfile: { name: "x".repeat(500) } });
    expect(ctx.userProfile.name.length).toBeLessThanOrEqual(60);
  });

  it("coerces truthy values to booleans for device flags", () => {
    const ctx = normalizeInsightsRequest({
      userProfile: { smartMeterConnected: 1 as unknown as boolean },
    });
    expect(ctx.userProfile.smartMeterConnected).toBe(true);
  });
});

describe("buildInsightsPrompt", () => {
  it("includes key profile context in the prompt", () => {
    const ctx = normalizeInsightsRequest({
      userProfile: { name: "Maya", points: 120, streakDays: 4, smartMeterConnected: true },
    });
    const prompt = buildInsightsPrompt(ctx);
    expect(prompt).toContain("Maya");
    expect(prompt).toContain("Current Points: 120");
    expect(prompt).toContain("Active Daily Streak: 4");
    expect(prompt).toContain("Smart Home Utility Meter Integrated: YES");
  });

  it("asks for a JSON object with insights and actions", () => {
    const prompt = buildInsightsPrompt(normalizeInsightsRequest({}));
    expect(prompt).toContain('"insights"');
    expect(prompt).toContain('"actions"');
  });
});

describe("parseInsightsResponse", () => {
  it("parses a clean JSON payload", () => {
    const raw = JSON.stringify({
      insights: "### Hi",
      actions: [{ id: "a1", text: "Do thing", savedKg: 2, cost: "Free" }],
    });
    const result = parseInsightsResponse(raw);
    expect(result?.insights).toBe("### Hi");
    expect(result?.actions).toHaveLength(1);
    expect(result?.actions[0].cost).toBe("Free");
  });

  it("strips markdown code fences before parsing", () => {
    const raw = '```json\n{"insights":"hello","actions":[]}\n```';
    expect(parseInsightsResponse(raw)?.insights).toBe("hello");
  });

  it("defaults an invalid cost to Free and drops actions without text", () => {
    const raw = JSON.stringify({
      insights: "x",
      actions: [
        { id: "a1", text: "Valid", savedKg: 1, cost: "Bogus" },
        { id: "a2", savedKg: 1, cost: "Low" },
      ],
    });
    const result = parseInsightsResponse(raw);
    expect(result?.actions).toHaveLength(1);
    expect(result?.actions[0].cost).toBe("Free");
  });

  it("returns null for malformed JSON", () => {
    expect(parseInsightsResponse("not json")).toBeNull();
  });

  it("returns null when insights are missing", () => {
    expect(parseInsightsResponse(JSON.stringify({ actions: [] }))).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseInsightsResponse("")).toBeNull();
    expect(parseInsightsResponse(null)).toBeNull();
  });
});

describe("fallbackInsights", () => {
  it("always returns insights and exactly three actions", () => {
    const result = fallbackInsights();
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.actions).toHaveLength(3);
  });

  it("personalizes copy with the user's name and connected devices", () => {
    const result = fallbackInsights({ name: "Maya", smartMeterConnected: true });
    expect(result.insights).toContain("Maya");
    expect(result.insights).toContain("is live");
  });

  it("guides the user to connect devices when they are off", () => {
    const result = fallbackInsights({ name: "Sam", smartMeterConnected: false, transportTrackerConnected: false });
    expect(result.insights).toContain("Connect your");
  });
});
