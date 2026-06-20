import { describe, it, expect } from "vitest";
import {
  MAX_CHAT_HISTORY,
  MAX_MESSAGE_LEN,
  normalizeChatMessages,
  normalizeChatProfile,
  buildChatSystemPrompt,
  toGeminiContents,
  fallbackChatReply,
} from "./chat";

describe("normalizeChatMessages", () => {
  it("returns an empty array for non-array input", () => {
    expect(normalizeChatMessages(undefined)).toEqual([]);
    expect(normalizeChatMessages("nope")).toEqual([]);
  });

  it("drops entries without text and coerces roles", () => {
    const result = normalizeChatMessages([
      { role: "user", text: "hello" },
      { role: "assistant", text: "" },
      { role: "model", text: "hi there" },
      { nope: true },
    ]);
    expect(result).toEqual([
      { role: "user", text: "hello" },
      { role: "model", text: "hi there" },
    ]);
  });

  it("treats unknown roles as user", () => {
    const result = normalizeChatMessages([{ role: "system", text: "x" }]);
    expect(result[0].role).toBe("user");
  });

  it("keeps only the most recent turns", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: "user", text: `m${i}` }));
    const result = normalizeChatMessages(many);
    expect(result).toHaveLength(MAX_CHAT_HISTORY);
    expect(result[result.length - 1].text).toBe("m29");
  });

  it("truncates over-long messages", () => {
    const result = normalizeChatMessages([{ role: "user", text: "x".repeat(5000) }]);
    expect(result[0].text.length).toBe(MAX_MESSAGE_LEN);
  });
});

describe("normalizeChatProfile", () => {
  it("provides safe defaults", () => {
    const p = normalizeChatProfile(undefined);
    expect(p.name).toBe("there");
    expect(p.points).toBe(0);
    expect(p.smartMeterConnected).toBe(false);
  });

  it("clamps invalid numbers and coerces booleans", () => {
    const p = normalizeChatProfile({ points: -5, smartMeterConnected: 1 as unknown as boolean });
    expect(p.points).toBe(0);
    expect(p.smartMeterConnected).toBe(true);
  });
});

describe("buildChatSystemPrompt", () => {
  it("embeds the persona and user context", () => {
    const prompt = buildChatSystemPrompt(normalizeChatProfile({ name: "Maya", streakDays: 7 }));
    expect(prompt).toContain("Eco Assistant");
    expect(prompt).toContain("Maya");
    expect(prompt).toContain("Active streak: 7 days");
  });

  it("instructs the model to stay on topic", () => {
    const prompt = buildChatSystemPrompt(normalizeChatProfile({}));
    expect(prompt.toLowerCase()).toContain("sustainability");
  });

  it("applies the CO-STAR framework sections", () => {
    const prompt = buildChatSystemPrompt(normalizeChatProfile({}));
    for (const section of [
      "# CONTEXT",
      "# OBJECTIVE",
      "# STYLE",
      "# TONE",
      "# AUDIENCE",
      "# RESPONSE FORMAT",
    ]) {
      expect(prompt).toContain(section);
    }
  });

  it("includes a chain-of-thought instruction and few-shot examples", () => {
    const prompt = buildChatSystemPrompt(normalizeChatProfile({}));
    expect(prompt).toContain("# REASONING");
    expect(prompt.toLowerCase()).toContain("step by step");
    expect(prompt).toContain("# EXAMPLES");
    expect(prompt).toContain("Example 1");
    expect(prompt).toContain("Example 2");
  });
});

describe("toGeminiContents", () => {
  it("maps messages into role + parts shape", () => {
    const contents = toGeminiContents([
      { role: "user", text: "hi" },
      { role: "model", text: "hello" },
    ]);
    expect(contents).toEqual([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "hello" }] },
    ]);
  });
});

describe("fallbackChatReply", () => {
  it("returns transport guidance for commute questions", () => {
    const reply = fallbackChatReply([{ role: "user", text: "How do I cut my car commute?" }]);
    expect(reply.toLowerCase()).toContain("transport");
  });

  it("returns diet guidance for food questions", () => {
    const reply = fallbackChatReply([{ role: "user", text: "Is eating beef bad for emissions?" }]);
    expect(reply.toLowerCase()).toContain("meat");
  });

  it("returns energy guidance for electricity questions", () => {
    const reply = fallbackChatReply([
      { role: "user", text: "How can I reduce my electricity use?" },
    ]);
    expect(reply.toLowerCase()).toContain("energy");
  });

  it("falls back to general tips when nothing matches", () => {
    const reply = fallbackChatReply([{ role: "user", text: "hello" }]);
    expect(reply.toLowerCase()).toContain("carbon footprint");
  });
});
