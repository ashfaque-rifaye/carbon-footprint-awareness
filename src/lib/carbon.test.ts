import { describe, it, expect } from "vitest";
import {
  BASE_POINTS,
  POINTS_PER_KG,
  calculatePoints,
  roundKg,
  calculateTransitSavings,
  treesEquivalent,
  toDateKey,
  nextStreak,
  resolveStreakOnLogin,
  smartMeterOffset,
} from "./carbon";

describe("calculatePoints", () => {
  it("awards base points for a zero-saving activity", () => {
    expect(calculatePoints(0)).toBe(BASE_POINTS);
  });

  it("adds the per-kg bonus on top of the base", () => {
    expect(calculatePoints(4)).toBe(BASE_POINTS + 4 * POINTS_PER_KG);
  });

  it("rounds fractional results to the nearest integer", () => {
    expect(calculatePoints(1.25)).toBe(Math.round(BASE_POINTS + 1.25 * POINTS_PER_KG));
  });

  it("clamps negative and non-finite savings to the base", () => {
    expect(calculatePoints(-10)).toBe(BASE_POINTS);
    expect(calculatePoints(NaN)).toBe(BASE_POINTS);
  });
});

describe("roundKg", () => {
  it("rounds to two decimals", () => {
    expect(roundKg(1.236)).toBe(1.24);
  });

  it("returns 0 for non-finite input", () => {
    expect(roundKg(Infinity)).toBe(0);
  });
});

describe("calculateTransitSavings", () => {
  it("computes full petrol offset for zero-emission modes", () => {
    expect(calculateTransitSavings(10, "bike")).toBe(2.2);
    expect(calculateTransitSavings(10, "walk")).toBe(2.2);
  });

  it("uses lower offsets for partially-emitting modes", () => {
    expect(calculateTransitSavings(10, "ev")).toBe(1.3);
    expect(calculateTransitSavings(10, "train")).toBe(1.7);
  });

  it("returns 0 for non-positive distances", () => {
    expect(calculateTransitSavings(0, "bike")).toBe(0);
    expect(calculateTransitSavings(-5, "bike")).toBe(0);
  });
});

describe("treesEquivalent", () => {
  it("returns 0 when nothing has been saved", () => {
    expect(treesEquivalent(0)).toBe(0);
  });

  it("reports at least one tree once any saving exists", () => {
    expect(treesEquivalent(1)).toBe(1);
  });

  it("scales with larger savings", () => {
    expect(treesEquivalent(100)).toBe(4.5);
  });
});

describe("nextStreak", () => {
  it("starts a streak at 1 when there is no prior activity", () => {
    expect(nextStreak(0, null, "2026-06-13")).toBe(1);
  });

  it("keeps the streak unchanged on the same day", () => {
    expect(nextStreak(5, "2026-06-13", "2026-06-13")).toBe(5);
  });

  it("increments when the last activity was yesterday", () => {
    expect(nextStreak(5, "2026-06-12", "2026-06-13")).toBe(6);
  });

  it("resets to 1 after a gap of more than one day", () => {
    expect(nextStreak(5, "2026-06-10", "2026-06-13")).toBe(1);
  });
});

describe("resolveStreakOnLogin", () => {
  it("preserves the streak when the last activity was recent", () => {
    expect(resolveStreakOnLogin(7, "2026-06-12", "2026-06-13")).toBe(7);
  });

  it("resets the streak when the gap exceeds one day", () => {
    expect(resolveStreakOnLogin(7, "2026-06-01", "2026-06-13")).toBe(1);
  });

  it("defaults to 1 when no last-active date exists", () => {
    expect(resolveStreakOnLogin(0, undefined, "2026-06-13")).toBe(1);
  });
});

describe("smartMeterOffset", () => {
  it("rewards solar yield that exceeds household load", () => {
    expect(smartMeterOffset(3, 1)).toBe(0.1);
  });

  it("returns 0 when load meets or exceeds solar yield", () => {
    expect(smartMeterOffset(1, 2)).toBe(0);
    expect(smartMeterOffset(2, 2)).toBe(0);
  });

  it("returns 0 for non-finite readings", () => {
    expect(smartMeterOffset(NaN, 1)).toBe(0);
  });
});

describe("toDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date("2026-06-13T15:30:00Z"))).toBe("2026-06-13");
  });
});
