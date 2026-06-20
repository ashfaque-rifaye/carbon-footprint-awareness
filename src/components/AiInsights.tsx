import { useState, useEffect } from "react";
import { Sparkles, Loader2, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { UserProfile, EmissionsLog } from "../types";
import { fallbackInsights } from "../lib/insights";

interface SuggestedAction {
  id: string;
  text: string;
  savedKg: number;
  cost: "Free" | "Low" | "Medium";
}

interface AiInsightsProps {
  userProfile: UserProfile | null;
  recentLogs: EmissionsLog[];
  simulatedSensors: {
    meterSaving: number;
    trackerMiles: number;
  };
  onLogEmission: (activity: string, category: "transport" | "energy" | "diet" | "waste", kg: number, source: "manual") => void;
}

export default function AiInsights({
  userProfile,
  recentLogs,
  simulatedSensors,
  onLogEmission,
}: AiInsightsProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [insightsHtml, setInsightsHtml] = useState<string>("");
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [completedSuggestIds, setCompletedSuggestIds] = useState<Set<string>>(new Set());

  // Trigger loading custom insights from server API
  const fetchAiInsights = async () => {
    if (!userProfile) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userProfile,
          recentLogs: recentLogs.slice(0, 5), // pass latest 5 logs to save token depth but provide rich context
          simulatedSensors,
        }),
      });

      if (!response.ok) {
        throw new Error("Insights request failed");
      }

      const data = await response.json();
      setInsightsHtml(data.insights || "");
      setSuggestedActions(data.actions || []);
    } catch (err) {
      console.error(err);
      // Reuse the shared deterministic engine so advice stays personalized even
      // when the network/AI is unavailable (no duplicated fallback copy).
      setErrorMsg("Couldn't reach the AI service — showing locally generated recommendations.");
      const fb = fallbackInsights({
        name: userProfile.name,
        streakDays: userProfile.streakDays,
        smartMeterConnected: userProfile.smartMeterConnected,
        transportTrackerConnected: userProfile.transportTrackerConnected,
      });
      setInsightsHtml(fb.insights);
      setSuggestedActions(fb.actions);
    } finally {
      setLoading(false);
    }
  };

  // Run on mounts
  useEffect(() => {
    if (userProfile && !insightsHtml) {
      fetchAiInsights();
    }
  }, [userProfile]);

  // Click action to execute suggestion
  const handleExecuteAction = (action: SuggestedAction) => {
    if (completedSuggestIds.has(action.id)) return;
    
    // Fire emission logger
    onLogEmission(
      `AI Suggested Challenge: ${action.text}`,
      action.id.includes("transit") || action.id.includes("bike") ? "transport" : action.id.includes("diet") ? "diet" : "energy",
      action.savedKg,
      "manual"
    );

    // Add to local completed set
    const updated = new Set(completedSuggestIds);
    updated.add(action.id);
    setCompletedSuggestIds(updated);
  };

  return (
    <div id="ai_coaching_widget" className="glass rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-brand-500/20">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Widget Header */}
      <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-amber-500/10 p-2 rounded-xl text-amber-300">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-white">AI Carbon Mitigation Coach</h3>
            <p className="text-xs text-emerald-200/60">Tailored by Gemini 3.5 Flash</p>
          </div>
        </div>
        <button
          onClick={fetchAiInsights}
          disabled={loading}
          className="text-slate-200 hover:text-white p-2 rounded-lg bg-white/5 border border-white/10 transition-all text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Recalculate smart insights"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Reanalyse
        </button>
      </div>

      <div>
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-fadeIn">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <div className="space-y-1">
              <p className="font-display font-bold text-sm text-slate-200">Reading your telemetry &amp; impact logs...</p>
              <p className="text-xs text-slate-400 max-w-xs">Gemini is synthesizing customized optimization paths for your carbon footprint model.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            {/* Display error if fallback was activated */}
            {errorMsg && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Render formatted AI markdown insights */}
            <div className="prose prose-invert text-xs text-slate-200 space-y-3 leading-relaxed max-h-[220px] overflow-y-auto pr-2">
              {insightsHtml.split("\n\n").map((chunk, index) => {
                // Render list items clean
                if (chunk.startsWith("* ") || chunk.startsWith("- ")) {
                  return (
                    <ul key={index} className="list-disc pl-5 space-y-1 my-1">
                      {chunk.split("\n").map((li, i) => (
                        <li key={i}>{li.replace(/^(\*\s+|\-\s+)/, "")}</li>
                      ))}
                    </ul>
                  );
                }
                
                // Render headers
                if (chunk.startsWith("### ")) {
                  return <h4 key={index} className="font-display font-bold text-sm text-white pt-2">{chunk.replace("### ", "")}</h4>;
                }
                if (chunk.startsWith("## ")) {
                  return <h3 key={index} className="font-display font-bold text-base text-white pt-2">{chunk.replace("## ", "")}</h3>;
                }
                if (chunk.startsWith("**") && chunk.endsWith("**")) {
                  return <p key={index} className="font-bold text-amber-400 my-1">{chunk.replaceAll("**", "")}</p>;
                }
                
                return <p key={index}>{chunk}</p>;
              })}
            </div>

            {/* Render Recommended Challenges actions block */}
            {suggestedActions.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Customized Eco Opportunities Log
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {suggestedActions.map((action) => {
                    const isCompleted = completedSuggestIds.has(action.id);
                    return (
                      <button
                        key={action.id}
                        type="button"
                        disabled={isCompleted}
                        onClick={() => handleExecuteAction(action)}
                        aria-label={isCompleted ? `Claimed: ${action.text}` : `Claim task: ${action.text}, saves ${action.savedKg} kg CO2`}
                        className={`border rounded-xl p-3.5 flex flex-col justify-between text-left transition-all relative overflow-hidden ${
                          isCompleted
                            ? "bg-white/5 border-white/5 text-slate-500 cursor-default"
                            : "bg-white/5 border border-white/10 hover:border-amber-500/40 hover:bg-white/10 cursor-pointer hover:shadow-lg hover:shadow-amber-500/5 active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                        }`}
                      >
                        {isCompleted && (
                          <span className="absolute top-1.5 right-1.5 text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          </span>
                        )}
                        <span className="block">
                          <span className={`block text-xs font-bold ${isCompleted ? "text-slate-500" : "text-white"} leading-snug mb-1.5`}>
                            {action.text}
                          </span>
                          <span className="flex gap-2 items-center text-[10px] text-slate-400">
                            <span className="bg-slate-950/40 px-2 py-0.5 rounded border border-white/10 font-mono text-emerald-300">
                              -{action.savedKg} kg
                            </span>
                            <span className="text-amber-400 font-medium font-mono">Bounty: High</span>
                          </span>
                        </span>

                        {!isCompleted && (
                          <span className="mt-3.5 flex items-center justify-end text-[10px] text-emerald-300 font-bold font-mono">
                            Claim Task <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
