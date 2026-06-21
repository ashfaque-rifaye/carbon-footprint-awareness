import { History, Trash2 } from "lucide-react";
import type { EmissionsLog, ActivityCategory } from "../types";

const LEDGER_COLORS: Record<ActivityCategory, string> = {
  diet: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  transport: "text-blue-400 border-blue-500/20 bg-blue-500/5",
  energy: "text-amber-400 border-amber-500/20 bg-amber-500/5",
  waste: "text-purple-400 border-purple-500/20 bg-purple-500/5",
};

interface CarbonLedgerPanelProps {
  emissionsLogs: EmissionsLog[];
  onDeleteLog: (logId: string) => void;
}

/** "Carbon Ledger" tab: the immutable-style activity history with delete. */
export default function CarbonLedgerPanel({ emissionsLogs, onDeleteLog }: CarbonLedgerPanelProps) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-4 border-b border-white/5 mb-6 gap-3">
        <div>
          <h3 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
            <History className="text-teal-400 w-5 h-5 shrink-0" /> Carbon Audit Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Definitive ecosystem savings logs validated across real-time dynamic thresholds
          </p>
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
                <span
                  className={`p-2 rounded-lg border font-mono text-[9px] font-bold shrink-0 uppercase tracking-wider ${LEDGER_COLORS[log.category] || "border-white/5 bg-white/5 text-slate-400"}`}
                >
                  {log.category}
                </span>
                <div>
                  <span className="font-bold text-white block text-sm leading-tight">
                    {log.activityName}
                  </span>
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
                  <Trash2
                    className="w-4 h-4 text-slate-550 hover:text-red-400"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center text-slate-500 space-y-2 border border-dashed border-white/5 rounded-2xl bg-slate-950/20">
            <History className="w-8 h-8 text-slate-650 mx-auto opacity-50 mb-1" />
            <p className="text-sm font-bold text-slate-400">
              The ecological footprint audit ledger is empty.
            </p>
            <p className="text-xs max-w-sm mx-auto">
              Claim tasks on the tracker tab or run smart IoT integrations to populate synchronized
              records!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
