import React, { useState } from "react";
import {
  TrendingDown, Trophy, Flame, Leaf, LayoutDashboard, History, Sparkles, Bot,
  Globe, Award, Plus, Check, Trash2, Bike, Sprout, Zap,
} from "lucide-react";
import {
  UserProfile, EmissionsLog, LeaderboardEntry, Milestone, STATIC_CHALLENGES,
} from "../types";
import { treesEquivalent } from "../lib/carbon";
import DeviceSimulator from "./DeviceSimulator";
import CommunityLeaderboard from "./CommunityLeaderboard";
import AiInsights from "./AiInsights";
import EcoAssistant from "./EcoAssistant";

type Category = "transport" | "energy" | "diet" | "waste";
type LogSource = "manual" | "smart_meter" | "transport_tracker";
type DashboardTab = "dashboard" | "ledger" | "insights" | "assistant" | "leaderboard";

interface DashboardProps {
  profile: UserProfile;
  emissionsLogs: EmissionsLog[];
  leaderboard: LeaderboardEntry[];
  milestones: Milestone[];
  simulatedSensors: { meterSaving: number; trackerMiles: number };
  onLogActivity: (activityName: string, category: Category, kgSaved: number, source: LogSource) => void;
  onDeleteLog: (logId: string) => void;
  onToggle: (field: "smartMeterConnected" | "transportTrackerConnected", val: boolean) => void;
  onCheer: (targetUserId: string, targetName: string) => void;
}

const TABS: { id: DashboardTab; label: string; icon: React.ReactNode; active: string }[] = [
  { id: "dashboard", label: "Eco Tracker", icon: <LayoutDashboard className="w-4 h-4 shrink-0" />, active: "text-emerald-400 border-emerald-500/20 shadow-emerald-500/5" },
  { id: "ledger", label: "Carbon Ledger", icon: <History className="w-4 h-4 shrink-0" />, active: "text-teal-400 border-teal-500/20 shadow-teal-500/5" },
  { id: "insights", label: "Smart AI Coach", icon: <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />, active: "text-purple-400 border-purple-500/20 shadow-purple-500/5" },
  { id: "assistant", label: "Eco Assistant", icon: <Bot className="w-4 h-4 shrink-0" />, active: "text-emerald-400 border-emerald-500/20 shadow-emerald-500/5" },
  { id: "leaderboard", label: "Standings & Badges", icon: <Trophy className="w-4 h-4 shrink-0" />, active: "text-amber-400 border-amber-500/20 shadow-amber-500/5" },
];

const LEDGER_COLORS: Record<Category, string> = {
  diet: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  transport: "text-blue-400 border-blue-500/20 bg-blue-500/5",
  energy: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  waste: "text-purple-400 border-purple-500/20 bg-purple-500/5",
};

function milestoneBadgeIcon(badge: string) {
  switch (badge) {
    case "shield": return <Award className="w-5 h-5 text-blue-400" />;
    case "trees": return <Globe className="w-5 h-5 text-emerald-300" />;
    case "zap": return <Zap className="w-5 h-5 text-amber-400 shrink-0" />;
    case "flame": return <Flame className="w-5 h-5 text-amber-500 animate-pulse" />;
    default: return <Sprout className="w-5 h-5 text-emerald-400" />;
  }
}

function categoryIcon(category: string) {
  switch (category) {
    case "diet": return <Leaf className="w-5 h-5 text-emerald-400" />;
    case "transport": return <Bike className="w-5 h-5 text-blue-400" />;
    case "energy": return <Zap className="w-5 h-5 text-amber-400" />;
    case "waste": return <Trash2 className="w-5 h-5 text-purple-400" />;
    default: return <Sprout className="w-5 h-5 text-emerald-400" />;
  }
}

/**
 * Authenticated dashboard: stat cards, tab navigation, and the five panels
 * (tracker/challenges, ledger, AI coach, assistant, leaderboard). Owns only its
 * own UI state (active tab/category, custom-offset form); all data and mutations
 * come from the parent via props.
 */
export default function Dashboard({
  profile, emissionsLogs, leaderboard, milestones, simulatedSensors,
  onLogActivity, onDeleteLog, onToggle, onCheer,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");
  const [activeCategory, setActiveCategory] = useState<"all" | Category>("all");
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [customActionName, setCustomActionName] = useState("");
  const [customActionType, setCustomActionType] = useState<Category>("energy");
  const [customActionSavings, setCustomActionSavings] = useState(1.5);

  const handleCreateCustomAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customActionName.trim() || customActionSavings <= 0) return;
    onLogActivity(customActionName, customActionType, parseFloat(customActionSavings.toFixed(1)), "manual");
    setCustomActionName("");
    setIsCustomFormOpen(false);
  };

  const stats = [
    { label: "Total Carbon Saved", value: profile.totalSavedKg.toFixed(1), unit: "kg CO₂", color: "text-brand-400", border: "border-l-brand-500", note: "Continuous lifestyle offset", icon: <TrendingDown className="w-3.5 h-3.5 text-brand-400" /> },
    { label: "Eco Level Points", value: String(profile.points), unit: "XP", color: "text-amber-500", border: "border-l-amber-500", note: "Unlock next level milestone", icon: <Trophy className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> },
    { label: "Daily Active Streak", value: String(profile.streakDays), unit: "Days", color: "text-red-500", border: "border-l-red-500", note: "Maintain active logging chain", icon: <Flame className="w-3.5 h-3.5 text-red-500 animate-bounce" /> },
    { label: "Trees Equivalent", value: String(treesEquivalent(profile.totalSavedKg)), unit: "Trees", color: "text-blue-400", border: "border-l-blue-500", note: "Annual mature absorption equivalent", icon: <Leaf className="w-3.5 h-3.5 text-blue-400 shrink-0" /> },
  ];

  return (
    <div className="space-y-8">

      {/* Quick Metrics stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`glass rounded-2xl p-5 border-l-4 ${s.border} relative overflow-hidden`}>
            <span className="text-xs text-slate-400 uppercase font-mono block mb-1">{s.label}</span>
            <span className={`font-display font-extrabold text-2xl md:text-3xl ${s.color} block leading-tight font-mono`}>
              {s.value} <span className="text-xs text-slate-400 font-sans">{s.unit}</span>
            </span>
            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1.5">{s.icon} {s.note}</p>
          </div>
        ))}
      </div>

      {/* Workspace Segment Switcher Navigation Tabs */}
      <div className="flex justify-center my-6">
        <div role="tablist" aria-label="Dashboard sections" className="bg-slate-900/60 p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap gap-1.5 border border-white/5 w-full max-w-4xl shadow-xl">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-display font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? `bg-slate-800 border shadow-md font-black ${tab.active}`
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connection Sync Status Banner */}
      <div className="max-w-4xl mx-auto mb-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-left">
              <p className="text-white font-bold">Local Carbon Ledger Active</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Stored privately for account: <span className="font-mono text-blue-400 font-semibold">{profile.email}</span></p>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-white/5 py-1 px-3.5 rounded-full flex gap-3 text-[10px] font-mono text-slate-500 shrink-0">
            <span>STATUS: <span className="text-emerald-400 font-bold">READY</span></span>
            <span>•</span>
            <span>LEDGER: <span className="text-blue-400 font-bold">ACTIVE</span></span>
          </div>
        </div>
      </div>

      {/* ECO TRACKER TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-8 animate-fadeIn">
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
                <h3 className="font-display font-bold text-lg text-white">Daily Greenhouse Challenges</h3>
                <p className="text-xs text-slate-400">Claim challenges to score level points and reduce real footprint averages</p>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-white/5 border border-white/10 p-1 rounded-xl">
                {(["all", "transport", "energy", "diet", "waste"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-all ${
                      activeCategory === cat ? "bg-emerald-400 text-emerald-950 font-extrabold" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {cat.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STATIC_CHALLENGES.filter((ch) => activeCategory === "all" || ch.category === activeCategory).map((challenge) => (
                <div
                  key={challenge.id}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-white/20 hover:shadow-lg group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span>{categoryIcon(challenge.category)}</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold uppercase ${
                        challenge.difficulty === "Easy"
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/10"
                          : challenge.difficulty === "Medium"
                          ? "bg-amber-950/80 text-amber-300 border border-amber-500/10"
                          : "bg-red-950/80 text-red-300 border border-red-500/10"
                      }`}>
                        {challenge.difficulty}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">{challenge.title}</h4>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{challenge.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs">
                    <div className="flex gap-2">
                      <span className="text-emerald-300 font-mono text-[10px] font-bold">-{challenge.kgSaved} kg CO₂</span>
                      <span className="text-amber-400 font-mono text-[10px] font-bold">+{challenge.points} XP</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLogActivity(challenge.title, challenge.category, challenge.kgSaved, "manual")}
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
              <span className="text-slate-300">Have a custom green lifestyle offset that's not on the challenge lists?</span>
              <button
                type="button"
                onClick={() => setIsCustomFormOpen(!isCustomFormOpen)}
                className="px-4 py-2 bg-white/5 hover:bg-white/15 border border-white/10 text-white rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-emerald-400" /> Log Custom Offset Action
              </button>
            </div>

            {isCustomFormOpen && (
              <form onSubmit={handleCreateCustomAction} className="bg-white/5 p-5 rounded-2xl border border-white/15 space-y-4 text-xs backdrop-blur-xl animate-fadeIn">
                <h4 className="font-display font-bold text-white text-sm">Register Custom Eco Contribution</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="custom-action-name" className="text-slate-300 block mb-1">Action Description</label>
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
                    <label htmlFor="custom-action-type" className="text-slate-300 block mb-1">Ecological Category</label>
                    <select
                      id="custom-action-type"
                      value={customActionType}
                      onChange={(e) => setCustomActionType(e.target.value as Category)}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400 focus:bg-slate-950/90 transition-all font-sans"
                    >
                      <option value="energy">Renewable Energy Offset</option>
                      <option value="diet">Low-carbon Food Diet</option>
                      <option value="transport">Public/Micro Transportation</option>
                      <option value="waste">Circular Waste minimization</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="custom-action-savings" className="text-slate-300 block mb-1">Est. Savings (kg CO₂)</label>
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
                  <button type="button" onClick={() => setIsCustomFormOpen(false)} className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-all">
                    Discard
                  </button>
                  <button type="submit" className="px-5 py-2 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 rounded-lg transition-all font-bold">
                    Commit Audit Log
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* AUDIT LEDGER TAB */}
      {activeTab === "ledger" && (
        <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto text-left">
          <div className="glass rounded-2xl p-6 border border-white/5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-4 border-b border-white/5 mb-6 gap-3">
              <div>
                <h3 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
                  <History className="text-teal-400 w-5 h-5 shrink-0" /> Carbon Audit Ledger
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Definitive ecosystem savings logs validated across real-time dynamic thresholds</p>
              </div>
              <span className="font-mono text-xs text-teal-400 bg-teal-500/10 px-3.5 py-1.5 rounded-full border border-teal-500/20 font-bold self-start sm:self-auto shrink-0">
                {emissionsLogs.length} AUDIT LOGS
              </span>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {emissionsLogs.length > 0 ? (
                emissionsLogs.map((log) => (
                  <div
                    key={log.logId}
                    className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-slate-950/40 hover:bg-slate-950/80 hover:border-white/10 transition-all text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`p-2 rounded-lg border font-mono text-[9px] font-bold shrink-0 uppercase tracking-wider ${LEDGER_COLORS[log.category] || "border-white/5 bg-white/5 text-slate-400"}`}>
                        {log.category}
                      </span>
                      <div>
                        <span className="font-bold text-white block text-sm leading-tight">{log.activityName}</span>
                        <div className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[10.5px] text-slate-500 mt-1 font-mono">
                          <span>Source: {log.source.replace("_", " ")}</span>
                          <span>•</span>
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono font-bold text-sm">
                      <span className="text-emerald-450 font-bold font-mono">- {log.kgSaved} kg CO₂</span>
                      <button
                        type="button"
                        onClick={() => onDeleteLog(log.logId)}
                        className="text-slate-650 hover:text-red-450 p-2 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                        aria-label={`Remove log entry: ${log.activityName}`}
                      >
                        <Trash2 className="w-4 h-4 text-slate-550 hover:text-red-400" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-slate-500 space-y-2 border border-dashed border-white/5 rounded-2xl bg-slate-950/20">
                  <History className="w-8 h-8 text-slate-650 mx-auto opacity-50 mb-1" />
                  <p className="text-sm font-bold text-slate-400">The ecological footprint audit ledger is empty.</p>
                  <p className="text-xs max-w-sm mx-auto">Claim tasks on the tracker tab or run smart IoT integrations to populate synchronized records!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SMART AI COACH TAB */}
      {activeTab === "insights" && (
        <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto text-left col-span-1">
          <div className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-6">
              <div className="p-2.5 bg-purple-500/15 rounded-xl border border-purple-500/20">
                <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-lg text-white">Gemini Smart Ecological Coaching</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time intelligent recommendations based on active telemetry patterns and direct ledger audits</p>
              </div>
            </div>

            <AiInsights
              userProfile={profile}
              recentLogs={emissionsLogs}
              simulatedSensors={simulatedSensors}
              onLogEmission={onLogActivity}
            />
          </div>
        </div>
      )}

      {/* ECO ASSISTANT CHAT TAB */}
      {activeTab === "assistant" && (
        <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto text-left">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-2">
            <h3 className="font-display font-extrabold text-xl text-white tracking-tight flex items-center justify-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" /> Your Personal Eco Assistant
            </h3>
            <p className="text-xs text-slate-400">
              Chat with a Gemini-powered coach that knows your stats. Ask for tips tailored to your streak, savings, and connected devices.
            </p>
          </div>
          <EcoAssistant userProfile={profile} variant="full" />
        </div>
      )}

      {/* LEADERBOARD STANDINGS TAB */}
      {activeTab === "leaderboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn max-w-5xl mx-auto text-left">
          <div className="space-y-4">
            <CommunityLeaderboard
              currentUserId={profile.userId}
              leaderboard={leaderboard}
              userProfile={profile}
              onTriggerCheer={onCheer}
            />
          </div>

          <div className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden h-fit">
            <div className="flex items-center gap-2 pb-4 border-b border-white/5 mb-4">
              <Award className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h3 className="font-display font-bold text-base text-white">Ecological Badges</h3>
                <p className="text-xs text-slate-400">Completed thresholds, user achievements, and custom streak multiplier milestones</p>
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
                  <span className={`text-2xl p-2 rounded-lg ${ms.unlocked ? "bg-brand-500/10" : "bg-slate-950 grayscale opacity-60"}`}>
                    {milestoneBadgeIcon(ms.badge)}
                  </span>
                  <div>
                    <span className={`text-xs font-bold block ${ms.unlocked ? "text-brand-400" : "text-slate-500"}`}>{ms.title}</span>
                    <span className="text-[10.5px] text-slate-500 block leading-snug mt-0.5">{ms.requirement}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
