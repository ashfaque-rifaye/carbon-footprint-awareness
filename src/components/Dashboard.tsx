import React, { useState } from "react";
import { Trophy, LayoutDashboard, History, Sparkles, Bot, Globe } from "lucide-react";
import {
  type UserProfile,
  type EmissionsLog,
  type LeaderboardEntry,
  type Milestone,
  type ActivityCategory,
  type LogSource,
} from "../types";
import AiInsights from "./AiInsights";
import EcoAssistant from "./EcoAssistant";
import CommunityLeaderboard from "./CommunityLeaderboard";
import StatCards from "./StatCards";
import EcoTrackerPanel from "./EcoTrackerPanel";
import CarbonLedgerPanel from "./CarbonLedgerPanel";
import BadgesPanel from "./BadgesPanel";

type DashboardTab = "dashboard" | "ledger" | "insights" | "assistant" | "leaderboard";

interface DashboardProps {
  profile: UserProfile;
  emissionsLogs: EmissionsLog[];
  leaderboard: LeaderboardEntry[];
  milestones: Milestone[];
  simulatedSensors: { meterSaving: number; trackerMiles: number };
  onLogActivity: (
    activityName: string,
    category: ActivityCategory,
    kgSaved: number,
    source: LogSource
  ) => void;
  onDeleteLog: (logId: string) => void;
  onToggle: (field: "smartMeterConnected" | "transportTrackerConnected", val: boolean) => void;
  onCheer: (targetUserId: string, targetName: string) => void;
}

const TABS: { id: DashboardTab; label: string; icon: React.ReactNode; active: string }[] = [
  {
    id: "dashboard",
    label: "Eco Tracker",
    icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    active: "text-emerald-400 border-emerald-500/20 shadow-emerald-500/5",
  },
  {
    id: "ledger",
    label: "Carbon Ledger",
    icon: <History className="w-4 h-4 shrink-0" />,
    active: "text-teal-400 border-teal-500/20 shadow-teal-500/5",
  },
  {
    id: "insights",
    label: "Smart AI Coach",
    icon: <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />,
    active: "text-purple-400 border-purple-500/20 shadow-purple-500/5",
  },
  {
    id: "assistant",
    label: "Eco Assistant",
    icon: <Bot className="w-4 h-4 shrink-0" />,
    active: "text-emerald-400 border-emerald-500/20 shadow-emerald-500/5",
  },
  {
    id: "leaderboard",
    label: "Standings & Badges",
    icon: <Trophy className="w-4 h-4 shrink-0" />,
    active: "text-amber-400 border-amber-500/20 shadow-amber-500/5",
  },
];

/**
 * Authenticated dashboard shell: headline stats, the tab navigation, and the five
 * tab panels. Holds only the active-tab UI state; each panel is its own focused
 * component, and all data + mutations come from the parent via props.
 */
export default function Dashboard({
  profile,
  emissionsLogs,
  leaderboard,
  milestones,
  simulatedSensors,
  onLogActivity,
  onDeleteLog,
  onToggle,
  onCheer,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");

  return (
    <div className="space-y-8">
      <StatCards profile={profile} />

      {/* Workspace Segment Switcher Navigation Tabs */}
      <div className="flex justify-center my-6">
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="bg-slate-900/60 p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap gap-1.5 border border-white/5 w-full max-w-4xl shadow-xl"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-display font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
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
              <p className="text-slate-400 text-[11px] mt-0.5">
                Stored privately for account:{" "}
                <span className="font-mono text-blue-400 font-semibold">{profile.email}</span>
              </p>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-white/5 py-1 px-3.5 rounded-full flex gap-3 text-[10px] font-mono text-slate-500 shrink-0">
            <span>
              STATUS: <span className="text-emerald-400 font-bold">READY</span>
            </span>
            <span>•</span>
            <span>
              LEDGER: <span className="text-blue-400 font-bold">ACTIVE</span>
            </span>
          </div>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <div
          role="tabpanel"
          id="panel-dashboard"
          aria-labelledby="tab-dashboard"
          className="space-y-8 animate-fadeIn"
        >
          <EcoTrackerPanel profile={profile} onLogActivity={onLogActivity} onToggle={onToggle} />
        </div>
      )}

      {activeTab === "ledger" && (
        <div
          role="tabpanel"
          id="panel-ledger"
          aria-labelledby="tab-ledger"
          className="space-y-6 animate-fadeIn max-w-4xl mx-auto text-left"
        >
          <CarbonLedgerPanel emissionsLogs={emissionsLogs} onDeleteLog={onDeleteLog} />
        </div>
      )}

      {activeTab === "insights" && (
        <div
          role="tabpanel"
          id="panel-insights"
          aria-labelledby="tab-insights"
          className="space-y-6 animate-fadeIn max-w-4xl mx-auto text-left col-span-1"
        >
          <div className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-6">
              <div className="p-2.5 bg-purple-500/15 rounded-xl border border-purple-500/20">
                <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-lg text-white">
                  Gemini Smart Ecological Coaching
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time intelligent recommendations based on active telemetry patterns and
                  direct ledger audits
                </p>
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

      {activeTab === "assistant" && (
        <div
          role="tabpanel"
          id="panel-assistant"
          aria-labelledby="tab-assistant"
          className="space-y-6 animate-fadeIn max-w-4xl mx-auto text-left"
        >
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-2">
            <h3 className="font-display font-extrabold text-xl text-white tracking-tight flex items-center justify-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" /> Your Personal Eco Assistant
            </h3>
            <p className="text-xs text-slate-400">
              Chat with a Gemini-powered coach that knows your stats. Ask for tips tailored to your
              streak, savings, and connected devices.
            </p>
          </div>
          <EcoAssistant userProfile={profile} variant="full" />
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div
          role="tabpanel"
          id="panel-leaderboard"
          aria-labelledby="tab-leaderboard"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn max-w-5xl mx-auto text-left"
        >
          <div className="space-y-4">
            <CommunityLeaderboard
              currentUserId={profile.userId}
              leaderboard={leaderboard}
              userProfile={profile}
              onTriggerCheer={onCheer}
            />
          </div>
          <BadgesPanel milestones={milestones} />
        </div>
      )}
    </div>
  );
}
