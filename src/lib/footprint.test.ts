import { describe, it, expect } from "vitest";
import {
  summarizeByCategory,
  rankActionsByImpactEffort,
  buildFocusSummary,
  EFFORT_WEIGHT,
} from "./footprint";
import type { EmissionsLog } from "../types";

function log(category: EmissionsLog["category"], kgSaved: number): EmissionsLog {
  return {
    logId: `l_${Math.random()}`,
    userId: "u1",
    category,
    kgSaved,
    activityName: "x",
    timestamp: new Date().toISOString(),
    source: "manual",
  };
}

describe("summarizeByCategory", () => {
  it("returns zeroed categories and null top for an empty log", () => {
    const s = summarizeByCategory([]);
    expect(s.totalKg).toBe(0);
    expect(s.topCategory).toBeNull();
    expect(s.byCategory).toHaveLength(4);
  });

  it("aggregates savings per category and computes total", () => {
    const s = summarizeByCategory([log("transport", 5), log("transport", 3), log("diet", 2)]);
    expect(s.totalKg).toBe(10);
    const transport = s.byCategory.find((c) => c.category === "transport")!;
    expect(transport.totalKg).toBe(8);
    expect(transport.count).toBe(2);
  });

  it("identifies the top contributing category", () => {
    const s = summarizeByCategory([log("energy", 1), log("transport", 9)]);
    expect(s.topCategory).toBe("transport");
    expect(s.byCategory[0].category).toBe("transport");
  });

  it("computes the share of each category", () => {
    const s = summarizeByCategory([log("transport", 3), log("diet", 1)]);
    const transport = s.byCategory.find((c) => c.category === "transport")!;
    expect(transport.share).toBeCloseTo(0.75, 2);
  });

  it("ignores invalid or negative kg values", () => {
    const s = summarizeByCategory([
      log("transport", -5),
      log("transport", NaN as unknown as number),
    ]);
    expect(s.totalKg).toBe(0);
  });
});

describe("rankActionsByImpactEffort", () => {
  it("ranks a high-impact free action above a low-impact one", () => {
    const ranked = rankActionsByImpactEffort([
      { id: "a", text: "small", savedKg: 1, cost: "Free" },
      { id: "b", text: "big", savedKg: 5, cost: "Free" },
    ]);
    expect(ranked[0].id).toBe("b");
  });

  it("prefers an easier action when impact is similar", () => {
    const ranked = rankActionsByImpactEffort([
      { id: "hard", text: "hard", savedKg: 3, cost: "Medium" },
      { id: "easy", text: "easy", savedKg: 3, cost: "Free" },
    ]);
    expect(ranked[0].id).toBe("easy");
  });

  it("computes impact-per-effort using the effort weights", () => {
    const ranked = rankActionsByImpactEffort([{ id: "x", text: "x", savedKg: 6, cost: "Medium" }]);
    expect(ranked[0].impactEffortScore).toBe(6 / EFFORT_WEIGHT.Medium);
  });
});

describe("buildFocusSummary", () => {
  it("guides a first action when there is no data", () => {
    const summary = summarizeByCategory([]);
    expect(buildFocusSummary(summary).toLowerCase()).toContain("no activity logged");
  });

  it("names the top driver and its share", () => {
    const summary = summarizeByCategory([log("transport", 8), log("diet", 2)]);
    const text = buildFocusSummary(summary);
    expect(text).toContain("Transport");
    expect(text).toContain("80%");
  });

  it("flags untouched categories with quick-win potential", () => {
    const summary = summarizeByCategory([log("transport", 5)]);
    const text = buildFocusSummary(summary);
    expect(text.toLowerCase()).toContain("untouched");
    expect(text).toContain("Waste");
  });
});
