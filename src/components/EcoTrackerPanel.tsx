import React, { useState } from "react";
import { Plus, Check, Leaf, Bike, Zap, Trash2, Sprout } from "lucide-react";
import {
  STATIC_CHALLENGES,
  type UserProfile,
  type ActivityCategory,
  type LogSource,
} from "../types";
import DeviceSimulator from "./DeviceSimulator";

interface EcoTrackerPanelProps {
  profile: UserProfile;
  onLogActivity: (
    activityName: string,
    category: ActivityCategory,
    kgSaved: number,
    source: LogSource
  ) => void;
  onToggle: (field: "smartMeterConnected" | "transportTrackerConnected", val: boolean) => void;
}

function categoryIcon(category: string) {
  switch (category) {
    case "diet":
      return <Leaf className="w-5 h-5 text-emerald-400" />;
    case "transport":
      return <Bike className="w-5 h-5 text-blue-400" />;
    case "energy":
      return <Zap className="w-5 h-5 text-amber-400" />;
    case "waste":
      return <Trash2 className="w-5 h-5 text-purple-400" />;
    default:
      return <Sprout className="w-5 h-5 text-emerald-400" />;
  }
}

/**
 * "Eco Tracker" tab: simulated IoT devices plus the daily challenge grid and the
 * custom-offset form. Owns its own filter + form UI state; logging is delegated
 * to the parent via `onLogActivity`.
 */
export default function EcoTrackerPanel({
  profile,
  onLogActivity,
  onToggle,
}: EcoTrackerPanelProps) {
  const [activeCategory, setActiveCategory] = useState<"all" | ActivityCategory>("all");
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [customActionName, setCustomActionName] = useState("");
  const [customActionType, setCustomActionType] = useState<ActivityCategory>("energy");
  const [customActionSavings, setCustomActionSavings] = useState(1.5);

  const handleCreateCustomAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customActionName.trim() || customActionSavings <= 0) return;
    onLogActivity(
      customActionName,
      customActionType,
      parseFloat(customActionSavings.toFixed(1)),
      "manual"
    );
    setCustomActionName("");
    setIsCustomFormOpen(false);
  };

  const visibleChallenges = STATIC_CHALLENGES.filter(
    (ch) => activeCategory === "all" || ch.category === activeCategory
  );

  return (
    <>
      <DeviceSimulator
        onLogEmission={onLogActivity}
        smartConnected={profile.smartMeterConnected}
        transportConnected={profile.transportTrackerConnected}
        onToggleSmart={(val) => onToggle("smartMeterConnected", val)}
        onToggleTransport={(val) => onToggle("transportTrackerConnected", val)}
      />

      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-display font-bold text-lg text-white">
              Daily Greenhouse Challenges
            </h3>
            <p className="text-xs text-slate-400">
              Claim challenges to score level points and reduce real footprint averages
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-white/5 border border-white/10 p-1 rounded-xl">
            {(["all", "transport", "energy", "diet", "waste"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-all ${
                  activeCategory === cat
                    ? "bg-emerald-400 text-emerald-950 font-extrabold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleChallenges.map((challenge) => (
            <div
              key={challenge.id}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-white/20 hover:shadow-lg group"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span>{categoryIcon(challenge.category)}</span>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold uppercase ${
                      challenge.difficulty === "Easy"
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/10"
                        : challenge.difficulty === "Medium"
                          ? "bg-amber-950/80 text-amber-300 border border-amber-500/10"
                          : "bg-red-950/80 text-red-300 border border-red-500/10"
                    }`}
                  >
                    {challenge.difficulty}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1">{challenge.title}</h4>
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {challenge.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs">
                <div className="flex gap-2">
                  <span className="text-emerald-300 font-mono text-[10px] font-bold">
                    -{challenge.kgSaved} kg CO₂
                  </span>
                  <span className="text-amber-400 font-mono text-[10px] font-bold">
                    +{challenge.points} XP
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onLogActivity(challenge.title, challenge.category, challenge.kgSaved, "manual")
                  }
                  aria-label={`Log action: ${challenge.title}, saves ${challenge.kgSaved} kg CO2`}
                  className="px-3.5 py-1.5 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400 hover:text-emerald-950 rounded-lg font-display font-extrabold transition-all text-xs cursor-pointer active:scale-95 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                  Log Action <Check className="w-3 h-3 ml-0.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
          <span className="text-slate-300">
            Have a custom green lifestyle offset that's not on the challenge lists?
          </span>
          <button
            type="button"
            onClick={() => setIsCustomFormOpen(!isCustomFormOpen)}
            className="px-4 py-2 bg-white/5 hover:bg-white/15 border border-white/10 text-white rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> Log Custom Offset Action
          </button>
        </div>

        {isCustomFormOpen && (
          <form
            onSubmit={handleCreateCustomAction}
            className="bg-white/5 p-5 rounded-2xl border border-white/15 space-y-4 text-xs backdrop-blur-xl animate-fadeIn"
          >
            <h4 className="font-display font-bold text-white text-sm">
              Register Custom Eco Contribution
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label htmlFor="custom-action-name" className="text-slate-300 block mb-1">
                  Action Description
                </label>
                <input
                  id="custom-action-name"
                  type="text"
                  placeholder="e.g. Sourced fresh backyard vegetables"
                  required
                  value={customActionName}
                  onChange={(e) => setCustomActionName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:bg-slate-950/90 transition-all font-sans"
                />
              </div>

              <div>
                <label htmlFor="custom-action-type" className="text-slate-300 block mb-1">
                  Ecological Category
                </label>
                <select
                  id="custom-action-type"
                  value={customActionType}
                  onChange={(e) => setCustomActionType(e.target.value as ActivityCategory)}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400 focus:bg-slate-950/90 transition-all font-sans"
                >
                  <option value="energy">Renewable Energy Offset</option>
                  <option value="diet">Low-carbon Food Diet</option>
                  <option value="transport">Public/Micro Transportation</option>
                  <option value="waste">Circular Waste minimization</option>
                </select>
              </div>

              <div>
                <label htmlFor="custom-action-savings" className="text-slate-300 block mb-1">
                  Est. Savings (kg CO₂)
                </label>
                <input
                  id="custom-action-savings"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100.0"
                  value={customActionSavings}
                  onChange={(e) => setCustomActionSavings(Number(e.target.value))}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400 focus:bg-slate-950/90 transition-all font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsCustomFormOpen(false)}
                className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-all"
              >
                Discard
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 rounded-lg transition-all font-bold"
              >
                Commit Audit Log
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
