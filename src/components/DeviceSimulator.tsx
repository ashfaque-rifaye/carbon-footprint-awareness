import { useState, useEffect } from "react";
import { Zap, Compass, Car, Bike, Train, Activity, Globe, RefreshCcw, Footprints } from "lucide-react";
import type { TransitMode } from "../types";
import { calculateTransitSavings, smartMeterOffset } from "../lib/carbon";

interface DeviceSimulatorProps {
  onLogEmission: (activity: string, category: "transport" | "energy" | "diet" | "waste", kg: number, source: "smart_meter" | "transport_tracker") => void;
  smartConnected: boolean;
  transportConnected: boolean;
  onToggleSmart: (val: boolean) => void;
  onToggleTransport: (val: boolean) => void;
}

export default function DeviceSimulator({
  onLogEmission,
  smartConnected,
  transportConnected,
  onToggleSmart,
  onToggleTransport,
}: DeviceSimulatorProps) {
  // Smart meter state variables
  const [currentLoad, setCurrentLoad] = useState<number>(1.8); // kW
  const [solarInput, setSolarInput] = useState<number>(0.2); // kW
  const [offsetSavings, setOffsetSavings] = useState<number>(0.0); // kgCO2

  // Transport Tracker state variables
  const [tripType, setTripType] = useState<string>("Commute to Hub");
  const [distanceKm, setDistanceKm] = useState<number>(10);
  const [transitMode, setTransitMode] = useState<TransitMode>("bike");
  const [simulationOngoing, setSimulationOngoing] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0);
  const [simEstimatedSavings, setSimEstimatedSavings] = useState<number>(0);

  // Recalculate estimated transit savings based on distance & mode selected
  useEffect(() => {
    setSimEstimatedSavings(calculateTransitSavings(distanceKm, transitMode));
  }, [distanceKm, transitMode]);

  // Simulated Smart Meter active solar load tick (automated background telemetry).
  // Depends only on the connection flag and the (stable) log callback so the
  // interval is created once per connect — not torn down and recreated on every
  // tick when the load/solar readings change.
  useEffect(() => {
    if (!smartConnected) return;
    const interval = setInterval(() => {
        // Vary simulated solar generation and home loads randomly around natural targets
        const newSolar = parseFloat((Math.random() * 2.8 + 0.4).toFixed(2)); // High day solar
        const newLoad = parseFloat((Math.random() * 1.5 + 0.5).toFixed(2));
        setSolarInput(newSolar);
        setCurrentLoad(newLoad);

        // If solar output is greater than home power load, generate automated carbon credits!
        const savingIncrement = smartMeterOffset(newSolar, newLoad);
        if (savingIncrement > 0) {
          setOffsetSavings((prev) => {
            const next = parseFloat((prev + savingIncrement).toFixed(3));
            // Auto log the accumulated carbon savings silently when it hits block increments of 0.5 kg!
            if (next >= 0.5) {
              onLogEmission(
                `Smart Meter Automated Household Offset (${newSolar}kW Solar excess)`,
                "energy",
                0.5,
                "smart_meter"
              );
              return 0.0; // Reset threshold counter
            }
            return next;
          });
        }
      }, 5000); // Poll/tick every 5 seconds
    return () => clearInterval(interval);
  }, [smartConnected, onLogEmission]);

  // Handle transport simulation timeline runner
  const handleStartTransportSimulation = () => {
    if (simulationOngoing) return;
    setSimulationOngoing(true);
    setSimProgress(0);

    const interval = setInterval(() => {
      setSimProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setSimulationOngoing(false);
          // Complete Voyage: Fire emission logs!
          onLogEmission(
            `Automated Tracker voyage via ${transitMode.toUpperCase()}: ${tripType} (${distanceKm} km)`,
            "transport",
            simEstimatedSavings,
            "transport_tracker"
          );
          return 100;
        }
        return prev + 10;
      });
    }, 200); // 2 seconds total voyage duration
  };

  return (
    <div id="simulator_container" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Smart Meter Widget */}
      <div id="smart_meter_widget" className="glass rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-brand-500/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Widget header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${smartConnected ? "bg-brand-500/20 text-brand-500 animate-pulse" : "bg-slate-800 text-slate-400"}`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-white">Smart Utility Meter</h3>
              <p className="text-xs text-slate-400">IoT Grid & Home Power Tracker</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleSmart(!smartConnected)}
            aria-pressed={smartConnected}
            aria-label={smartConnected ? "Disconnect smart utility meter" : "Connect smart utility meter"}
            className={`px-4 py-1.5 rounded-full font-display font-medium text-xs transition-all ${
              smartConnected
                ? "bg-brand-500/10 text-brand-500 border border-brand-500/40 hover:bg-brand-500/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {smartConnected ? "● Live Connected" : "Connect Smart Meter"}
          </button>
        </div>

        {/* Meter Interface panels */}
        {smartConnected ? (
          <div className="space-y-6 animate-fade-in-up">
            {/* Visual Solar and grid panel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 text-center">
                <span className="text-slate-400 text-xs block mb-1">Household Load</span>
                <span className="font-mono text-2xl font-bold text-amber-400">{currentLoad} <span className="text-xs">kW</span></span>
              </div>
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 text-center">
                <span className="text-slate-400 text-xs block mb-1">Solar Panel Yield</span>
                <span className="font-mono text-2xl font-bold text-brand-500">+{solarInput} <span className="text-xs">kW</span></span>
              </div>
            </div>

            {/* Smart Offset meter feedback */}
            <div className="bg-brand-500/5 rounded-xl border border-brand-500/10 p-4 relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-brand-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 animate-spin" /> Virtual Realtime Offsetting
                </span>
                <span className="font-mono text-xs text-brand-500 font-bold">{Math.round((offsetSavings / 0.5) * 100)}%</span>
              </div>
              
              {/* Progress toward auto save trigger */}
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div 
                  className="bg-brand-500 h-2 rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (offsetSavings / 0.5) * 100)}%` }}
                ></div>
              </div>
              
              <div className="mt-3 flex justify-between text-xs text-slate-400">
                <span>Excess power saves carbon passively</span>
                <span className="text-brand-400 font-medium">Accumulating: {offsetSavings} / 0.5 kg</span>
              </div>
            </div>

            <div className="flex gap-2 text-[10px] text-slate-500 items-start leading-relaxed">
              <Globe className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>While active and solar output exceeds household demand, the simulator generates automated carbon offsets that are recorded in your activity ledger every 0.5 kg!</span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">
            <p className="text-sm mb-2">Device currently disconnected.</p>
            <p className="text-xs max-w-sm mx-auto text-slate-600">Integrate simulated utility meters to passively monitor your smart power grid and earn credit during renewable peak hours.</p>
          </div>
        )}
      </div>

      {/* Transport Activity Tracker Widget */}
      <div id="transport_activity_widget" className="glass rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-brand-500/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Widget header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${transportConnected ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-400"}`}>
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-white">Transport Tracker</h3>
              <p className="text-xs text-slate-400">Active Multi-Modal Voyage Logging</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleTransport(!transportConnected)}
            aria-pressed={transportConnected}
            aria-label={transportConnected ? "Disconnect transport tracker" : "Connect transport tracker"}
            className={`px-4 py-1.5 rounded-full font-display font-medium text-xs transition-all ${
              transportConnected
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/40 hover:bg-blue-500/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {transportConnected ? "● Active GPS" : "Connect Tracker"}
          </button>
        </div>

        {/* Transport interface */}
        {transportConnected ? (
          <div className="space-y-4 animate-fade-in-up">
            {/* Form selections */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1.5">Destination Trip</label>
                <select
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white active:outline-none focus:outline-none"
                >
                  <option value="Daily Commute Office">Work Commute (Hub)</option>
                  <option value="Weekly Organic Market">Grocery Shop Market</option>
                  <option value="Weekend Nature Trip">Nature Wilderness Trail</option>
                  <option value="Gym Exercise Session">Fitness Activity run</option>
                </select>
              </div>
              
              <div>
                <label className="text-slate-400 block mb-1.5">Transit Velocity Mode</label>
                <div className="grid grid-cols-5 gap-1">
                  {(["walk", "bike", "electric_scooter", "train", "ev"] as const).map((mode) => {
                    const renderModeIcon = () => {
                      switch (mode) {
                        case "walk":
                          return <Footprints className={`w-3.5 h-3.5 mx-auto ${transitMode === mode ? "text-blue-200" : "text-blue-400"}`} />;
                        case "bike":
                          return <Bike className={`w-3.5 h-3.5 mx-auto ${transitMode === mode ? "text-indigo-200" : "text-indigo-400"}`} />;
                        case "electric_scooter":
                          return <Compass className={`w-3.5 h-3.5 mx-auto ${transitMode === mode ? "text-pink-200" : "text-pink-400"}`} />;
                        case "train":
                          return <Train className={`w-3.5 h-3.5 mx-auto ${transitMode === mode ? "text-emerald-200" : "text-emerald-400"}`} />;
                        case "ev":
                          return <Car className={`w-3.5 h-3.5 mx-auto ${transitMode === mode ? "text-amber-200" : "text-amber-400"}`} />;
                        default:
                          return <Activity className="w-3.5 h-3.5 mx-auto" />;
                      }
                    };
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTransitMode(mode)}
                        aria-pressed={transitMode === mode}
                        aria-label={`Transit mode: ${mode.replace("_", " ")}`}
                        className={`p-2 rounded-lg text-center border text-base transition-all flex items-center justify-center cursor-pointer ${
                          transitMode === mode
                            ? "border-blue-500 bg-blue-500/20 scale-105"
                            : "border-slate-800 bg-slate-900 hover:bg-slate-800"
                        }`}
                      >
                        {renderModeIcon()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Slider Distance */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Voyage Distance</span>
                <span className="font-mono text-white font-medium">{distanceKm} km</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full accent-blue-500 h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Estimations feedback */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Carbon Offset Savings</span>
                <span className="font-mono text-lg font-bold text-blue-400">+{simEstimatedSavings} kg CO₂</span>
              </div>
              <button
                type="button"
                disabled={simulationOngoing}
                onClick={handleStartTransportSimulation}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-display font-bold transition-all ${
                  simulationOngoing 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
                }`}
              >
                {simulationOngoing ? (
                  <>
                    <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Simulated GPS Log...
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5" /> Start Automated Log
                  </>
                )}
              </button>
            </div>

            {/* Progress line for ongoing simulated GPS log */}
            {simulationOngoing && (
              <div className="space-y-1.5 animate-fadeIn">
                <div className="w-full bg-slate-900 rounded-full h-1">
                  <div
                    className="bg-blue-400 h-1 rounded-full transition-all duration-200"
                    style={{ width: `${simProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-blue-400 font-mono">
                  <span>TRACKING SATELLITE HANDSHAKE</span>
                  <span>{simProgress}% COMPLETE</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500">
            <p className="text-sm mb-2">Smart GPS device currently inactive.</p>
            <p className="text-xs max-w-sm mx-auto text-slate-600">Connect the active virtual GPS tracker to simulate daily clean commutes, mass-transit voyages, and automatic carbon saving credit generation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
