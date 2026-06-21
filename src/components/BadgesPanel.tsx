import { Award, Globe, Zap, Flame, Sprout } from "lucide-react";
import type { Milestone } from "../types";

function milestoneBadgeIcon(badge: string) {
  switch (badge) {
    case "shield":
      return <Award className="w-5 h-5 text-blue-400" />;
    case "trees":
      return <Globe className="w-5 h-5 text-emerald-300" />;
    case "zap":
      return <Zap className="w-5 h-5 text-amber-400 shrink-0" />;
    case "flame":
      return <Flame className="w-5 h-5 text-amber-500 animate-pulse" />;
    default:
      return <Sprout className="w-5 h-5 text-emerald-400" />;
  }
}

/** Achievement badges, locked/unlocked by the user's points and streak. */
export default function BadgesPanel({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden h-fit">
      <div className="flex items-center gap-2 pb-4 border-b border-white/5 mb-4">
        <Award className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <h3 className="font-display font-bold text-base text-white">Ecological Badges</h3>
          <p className="text-xs text-slate-400">
            Completed thresholds, user achievements, and custom streak multiplier milestones
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {milestones.map((ms) => (
          <div
            key={ms.id}
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
              ms.unlocked
                ? "bg-brand-500/10 border-brand-500/35 text-white shadow-lg shadow-brand-500/5"
                : "bg-slate-900/40 border-slate-900 text-slate-500"
            }`}
          >
            <span
              className={`text-2xl p-2 rounded-lg ${ms.unlocked ? "bg-brand-500/10" : "bg-slate-950 grayscale opacity-60"}`}
            >
              {milestoneBadgeIcon(ms.badge)}
            </span>
            <div>
              <span
                className={`text-xs font-bold block ${ms.unlocked ? "text-brand-400" : "text-slate-500"}`}
              >
                {ms.title}
              </span>
              <span className="text-[10.5px] text-slate-500 block leading-snug mt-0.5">
                {ms.requirement}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
