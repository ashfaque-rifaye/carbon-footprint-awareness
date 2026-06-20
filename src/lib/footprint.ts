/**
 * Footprint analytics — pure helpers that turn a user's activity log into the
 * "biggest emission drivers + next best action" intelligence that powers the
 * carbon coach.
 *
 * This is the heart of the "smart, dynamic assistant": instead of generic advice,
 * the AI is handed a ranked breakdown of where the user's footprint actually
 * comes from and which actions give the most saving for the least effort.
 */

import type { EmissionsLog } from "../types";

export type Category = "transport" | "energy" | "diet" | "waste";

export const CATEGORIES: Category[] = ["transport", "energy", "diet", "waste"];

/** Human-readable labels for each tracked category. */
export const CATEGORY_LABEL: Record<Category, string> = {
  transport: "Transport",
  energy: "Home energy",
  diet: "Food & diet",
  waste: "Waste",
};

export interface CategoryBreakdown {
  category: Category;
  totalKg: number;
  count: number;
  /** Share of total saved CO2, 0..1. */
  share: number;
}

export interface FootprintSummary {
  totalKg: number;
  byCategory: CategoryBreakdown[];
  /** The category contributing the most savings, or null when there is no data. */
  topCategory: Category | null;
}

/**
 * Aggregate a user's logged savings by category and rank categories by their
 * contribution. Categories with no activity are still returned (zeroed) so the
 * coach can spot untouched areas.
 */
export function summarizeByCategory(logs: EmissionsLog[]): FootprintSummary {
  const totals: Record<Category, { kg: number; count: number }> = {
    transport: { kg: 0, count: 0 },
    energy: { kg: 0, count: 0 },
    diet: { kg: 0, count: 0 },
    waste: { kg: 0, count: 0 },
  };

  for (const log of logs ?? []) {
    const cat = log?.category as Category;
    if (!cat || !(cat in totals)) continue;
    const kg =
      typeof log.kgSaved === "number" && Number.isFinite(log.kgSaved) && log.kgSaved > 0
        ? log.kgSaved
        : 0;
    totals[cat].kg += kg;
    totals[cat].count += 1;
  }

  const totalKg = CATEGORIES.reduce((sum, c) => sum + totals[c].kg, 0);

  const byCategory: CategoryBreakdown[] = CATEGORIES.map((category) => ({
    category,
    totalKg: parseFloat(totals[category].kg.toFixed(2)),
    count: totals[category].count,
    share: totalKg > 0 ? parseFloat((totals[category].kg / totalKg).toFixed(3)) : 0,
  })).sort((a, b) => b.totalKg - a.totalKg);

  const topCategory = byCategory[0] && byCategory[0].totalKg > 0 ? byCategory[0].category : null;

  return { totalKg: parseFloat(totalKg.toFixed(2)), byCategory, topCategory };
}

/** Map an action's cost tier to a relative effort weight (lower = easier). */
export const EFFORT_WEIGHT: Record<"Free" | "Low" | "Medium", number> = {
  Free: 1,
  Low: 2,
  Medium: 3,
};

export interface RankableAction {
  id: string;
  text: string;
  savedKg: number;
  cost: "Free" | "Low" | "Medium";
}

export interface RankedAction extends RankableAction {
  /** Savings per unit of effort — higher means a better "quick win". */
  impactEffortScore: number;
}

/**
 * Rank candidate actions by impact-per-effort (kg CO2 saved ÷ effort weight), so
 * the "next best action" surfaced to the user is the highest-leverage, lowest-
 * friction option rather than just the biggest absolute number.
 */
export function rankActionsByImpactEffort(actions: RankableAction[]): RankedAction[] {
  return (actions ?? [])
    .map((a) => {
      const savedKg =
        typeof a.savedKg === "number" && Number.isFinite(a.savedKg) && a.savedKg > 0
          ? a.savedKg
          : 0;
      const effort = EFFORT_WEIGHT[a.cost] ?? EFFORT_WEIGHT.Medium;
      return { ...a, impactEffortScore: parseFloat((savedKg / effort).toFixed(3)) };
    })
    .sort((a, b) => b.impactEffortScore - a.impactEffortScore);
}

/**
 * Produce a short, natural-language "focus" line summarizing where the user's
 * footprint savings concentrate. Fed into the AI prompt so recommendations target
 * the real top driver instead of giving generic tips.
 */
export function buildFocusSummary(summary: FootprintSummary): string {
  if (!summary.topCategory || summary.totalKg <= 0) {
    return "No activity logged yet — recommend an easy first action in the category most relevant to a typical city lifestyle (usually transport or home energy).";
  }
  const top = summary.byCategory[0];
  const pct = Math.round(top.share * 100);
  const untouched = summary.byCategory
    .filter((c) => c.totalKg === 0)
    .map((c) => CATEGORY_LABEL[c.category]);
  const untouchedNote =
    untouched.length > 0
      ? ` Untouched areas with quick-win potential: ${untouched.join(", ")}.`
      : "";
  return `Biggest savings driver so far is ${CATEGORY_LABEL[top.category]} (${top.totalKg} kg, ~${pct}% of total).${untouchedNote}`;
}
