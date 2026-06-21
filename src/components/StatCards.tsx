import { TrendingDown, Trophy, Flame, Leaf } from "lucide-react";
import type { UserProfile } from "../types";
import { treesEquivalent } from "../lib/carbon";

/** The four headline impact metrics shown at the top of the dashboard. */
export default function StatCards({ profile }: { profile: UserProfile }) {
  const stats = [
    {
      label: "Total Carbon Saved",
      value: profile.totalSavedKg.toFixed(1),
      unit: "kg CO₂",
      color: "text-brand-400",
      border: "border-l-brand-500",
      note: "Continuous lifestyle offset",
      icon: <TrendingDown className="w-3.5 h-3.5 text-brand-400" />,
    },
    {
      label: "Eco Level Points",
      value: String(profile.points),
      unit: "XP",
      color: "text-amber-500",
      border: "border-l-amber-500",
      note: "Unlock next level milestone",
      icon: <Trophy className="w-3.5 h-3.5 text-amber-500 animate-pulse" />,
    },
    {
      label: "Daily Active Streak",
      value: String(profile.streakDays),
      unit: "Days",
      color: "text-red-500",
      border: "border-l-red-500",
      note: "Maintain active logging chain",
      icon: <Flame className="w-3.5 h-3.5 text-red-500 animate-bounce" />,
    },
    {
      label: "Trees Equivalent",
      value: String(treesEquivalent(profile.totalSavedKg)),
      unit: "Trees",
      color: "text-blue-400",
      border: "border-l-blue-500",
      note: "Annual mature absorption equivalent",
      icon: <Leaf className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`glass rounded-2xl p-5 border-l-4 ${s.border} relative overflow-hidden`}
        >
          <span className="text-xs text-slate-400 uppercase font-mono block mb-1">{s.label}</span>
          <span
            className={`font-display font-extrabold text-2xl md:text-3xl ${s.color} block leading-tight font-mono`}
          >
            {s.value} <span className="text-xs text-slate-400 font-sans">{s.unit}</span>
          </span>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1.5">
            {s.icon} {s.note}
          </p>
        </div>
      ))}
    </div>
  );
}
