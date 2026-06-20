import React, { useState, useEffect } from "react";
import { Sprout, Trophy, LogIn, LogOut, Check, Award } from "lucide-react";
import { UserProfile, EmissionsLog, LeaderboardEntry, Milestone, STATIC_MILESTONES } from "./types";

import LandingPage, { type AuthMode, type AvatarKey } from "./components/LandingPage";
import AvatarIcon from "./components/AvatarIcon";
import Dashboard from "./components/Dashboard";

/** Same-origin JSON fetch helper that always sends the session cookie. */
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
}

/** Derive which milestones are unlocked from the user's points and streak. */
function deriveMilestones(points: number, streakDays: number): Milestone[] {
  return STATIC_MILESTONES.map((ms) => ({
    ...ms,
    unlocked: ms.id === "badge_streak_king" ? streakDays >= 5 : points >= ms.pointsRequired,
  }));
}

export default function App() {
  // Authentication & session variables
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // `loadingSession` gates ONLY the initial "restore my session" check on first
  // load. In-flight login/register submits use `authSubmitting` so the auth form
  // stays mounted (and can show inline errors) instead of unmounting the page.
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  // Auth form inputs
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authName, setAuthName] = useState<string>("");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authAvatar, setAuthAvatar] = useState<AvatarKey>("sprout");
  const [authError, setAuthError] = useState<string>("");

  // Server-synced collections
  const [emissionsLogs, setEmissionsLogs] = useState<EmissionsLog[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>(STATIC_MILESTONES);

  // Animation indicators
  const [congratsBadge, setCongratsBadge] = useState<string | null>(null);
  const [floatingPoints, setFloatingPoints] = useState<number | null>(null);

  // System notification
  const [alertNotification, setAlertNotification] = useState<string>("");

  // Simulated live IoT telemetry tracker meters values
  const [simulatedSensors, setSimulatedSensors] = useState({
    meterSaving: 0.0,
    trackerMiles: 0.0,
  });

  // 1. Restore any existing session on first load; otherwise show the landing page.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          applyProfile(data.profile);
          await Promise.all([loadLogs(), loadLeaderboard()]);
        } else {
          // Not signed in: still load the public leaderboard for the landing view.
          await loadLeaderboard();
        }
      } catch (err) {
        console.error("Session restore failed:", err);
      } finally {
        setLoadingSession(false);
      }
    })();
  }, []);

  // Set profile state and recompute unlocked milestones from its stats.
  const applyProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    setMilestones(deriveMilestones(profile.points, profile.streakDays));
  };

  // Fetch the signed-in user's activity ledger.
  const loadLogs = async () => {
    try {
      const res = await apiFetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setEmissionsLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  };

  // Fetch the community standings (seeded with sample competitors server-side).
  const loadLeaderboard = async () => {
    try {
      const res = await apiFetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    }
  };

  // 2. Register a new account (name + email + password).
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authName.trim() || !authEmail.trim() || authPassword.length < 8) {
      setAuthError("Enter your name, a valid email, and a password of at least 8 characters.");
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: authName.trim(),
          email: authEmail.trim(),
          password: authPassword,
          avatar: authAvatar,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(data.error || "Could not create your account.");
        return;
      }
      setAuthPassword("");
      applyProfile(data.profile);
      window.scrollTo({ top: 0 });
      await Promise.all([loadLogs(), loadLeaderboard()]);
      setAlertNotification(`Welcome to CarbonSync, ${data.profile.name}! Your account is ready.`);
    } catch (err) {
      console.error(err);
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  // 3. Log in with an existing email + password.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authEmail.trim() || !authPassword) {
      setAuthError("Enter your email and password.");
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(data.error || "Invalid email or password.");
        return;
      }
      setAuthPassword("");
      applyProfile(data.profile);
      window.scrollTo({ top: 0 });
      await Promise.all([loadLogs(), loadLeaderboard()]);
      setAlertNotification(`Welcome back, ${data.profile.name}!`);
    } catch (err) {
      console.error(err);
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Session logout
  const handleLogout = async () => {
    try {
      // Send an explicit empty body so a Content-Length header is always set
      // (some proxies reject bodyless POSTs with HTTP 411).
      await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUserProfile(null);
    setEmissionsLogs([]);
    setMilestones(STATIC_MILESTONES);
    setAlertNotification("You have been signed out.");
  };

  // 4. Log a positive Carbon-Saving Activity (manual inputs, quick-challenges, simulations).
  //    Scoring, streak, and totals are computed server-side and returned authoritatively.
  const logCarbonSavingActivity = async (
    activityName: string,
    category: "transport" | "energy" | "diet" | "waste",
    kgSaved: number,
    source: "manual" | "smart_meter" | "transport_tracker"
  ) => {
    if (!userProfile) return;
    try {
      const res = await apiFetch("/api/logs", {
        method: "POST",
        body: JSON.stringify({ activityName, category, kgSaved, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertNotification(data.error || "Could not log this activity.");
        return;
      }

      setUserProfile(data.profile);
      setEmissionsLogs((prev) => [data.log, ...prev]);

      // Increment simulated sensor values for the insights logic.
      if (source === "smart_meter") {
        setSimulatedSensors((prev) => ({ ...prev, meterSaving: prev.meterSaving + 0.5 }));
      } else if (source === "transport_tracker") {
        setSimulatedSensors((prev) => ({ ...prev, trackerMiles: prev.trackerMiles + kgSaved }));
      }

      checkMilestoneAchievements(data.profile.points, data.profile.streakDays);
      triggerFloatingPointsFeedback(data.pointsAwarded);
      loadLeaderboard();
    } catch (err) {
      console.error("Log activity error:", err);
      setAlertNotification("Network error while logging activity.");
    }
  };

  // Badge unlock listener & notifications engine
  const checkMilestoneAchievements = (pointsTotal: number, streakTotal: number) => {
    let unlockedAny = false;
    const currentMilestones = milestones.map((ms) => {
      if (ms.unlocked) return ms;

      const passes =
        ms.id === "badge_streak_king" ? streakTotal >= 5 : pointsTotal >= ms.pointsRequired;
      if (passes) {
        setCongratsBadge(ms.badge + " Unlocked Badge: " + ms.title + "!");
        unlockedAny = true;
        return { ...ms, unlocked: true };
      }
      return ms;
    });

    if (unlockedAny) {
      setMilestones(currentMilestones);
      setTimeout(() => setCongratsBadge(null), 4500);
    }
  };

  const triggerFloatingPointsFeedback = (pointsAmt: number) => {
    setFloatingPoints(pointsAmt);
    setTimeout(() => setFloatingPoints(null), 1500);
  };

  // Helper delete action
  const handleDeleteLogEntry = async (logId: string) => {
    if (!userProfile) return;
    try {
      const res = await apiFetch(`/api/logs/${encodeURIComponent(logId)}`, { method: "DELETE" });
      if (res.ok) {
        setEmissionsLogs((prev) => prev.filter((l) => l.logId !== logId));
        setAlertNotification("Activity log entry cleared.");
        setTimeout(() => setAlertNotification(""), 3500);
      }
    } catch (err) {
      console.error("Delete log error:", err);
    }
  };

  // Persist a device-connection toggle (optimistic update + PATCH).
  const updateToggle = async (
    field: "smartMeterConnected" | "transportTrackerConnected",
    val: boolean
  ) => {
    if (!userProfile) return;
    setUserProfile({ ...userProfile, [field]: val });
    try {
      const res = await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ [field]: val }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
      }
    } catch (err) {
      console.error("Toggle update error:", err);
    }
  };

  // Trigger social mock support cheer interactions
  const handleTriggerCheer = (_targetUserId: string, targetName: string) => {
    setAlertNotification(`💖 You sent a solar-powered Eco Cheer to ${targetName}!`);
    setTimeout(() => setAlertNotification(""), 3500);
  };

  return (
    <div className="min-h-screen bg-[#0a1a10] font-sans text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Skip link for keyboard & screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-emerald-400 focus:text-emerald-950 focus:rounded-lg focus:font-bold"
      >
        Skip to main content
      </a>

      {/* Background Frosted Glass Glowing Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-600/25 rounded-full blur-[130px] md:blur-[160px]"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[50%] h-[50%] bg-blue-500/15 rounded-full blur-[110px] md:blur-[140px]"></div>
        <div className="absolute top-[45%] right-[10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Banner / Header */}
      <header className="sticky top-4 z-50 max-w-7xl mx-auto w-[calc(100%-2rem)] bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-lg relative">
        <div className="px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo element representation */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-400 rounded-xl shadow-lg shadow-emerald-500/20">
              <Sprout className="w-6 h-6 text-emerald-950 shrink-0" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-lg text-white leading-tight tracking-tight">
                CarbonSync
              </h1>
              <p className="text-[10px] text-emerald-300/80 font-mono">
                Dynamic Multi-Modal Impact Tracking
              </p>
            </div>
          </div>

          {/* User auth session selectors */}
          <div className="flex items-center gap-3">
            {userProfile ? (
              <div className="flex items-center gap-3 bg-white/10 pl-3.5 pr-2 py-1.5 rounded-full border border-white/20">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-slate-100 font-semibold block">
                    {userProfile.name}
                  </span>
                  <span className="text-[9px] text-emerald-300 font-mono font-bold block">
                    SIGNED IN
                  </span>
                </div>
                <span className="bg-white/15 p-1.5 rounded-full flex items-center justify-center">
                  <AvatarIcon avatar={userProfile.avatar} />
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-500/10 text-slate-300 hover:text-red-400 rounded-full transition-all cursor-pointer"
                  title="Sign out"
                  aria-label="Sign out of your account"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="#get-started"
                  onClick={() => setAuthMode("login")}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-lg text-xs font-display font-extrabold flex items-center gap-2 transition-all shadow-md shadow-emerald-500/15 hover:shadow-emerald-500/30 active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 shrink-0" /> Log in
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main
        id="main-content"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10"
      >
        {/* Dynamic Alerts Banner */}
        {alertNotification && (
          <div
            role="status"
            aria-live="polite"
            className="bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2.5 animate-fadeIn"
          >
            <Check className="w-4 h-4 shrink-0 text-brand-500" />
            <span>{alertNotification}</span>
          </div>
        )}

        {/* Milestone congrats banner */}
        {congratsBadge && (
          <div className="glass-accent rounded-2xl p-6 text-center border bg-brand-500/10 border-brand-500 relative overflow-hidden animate-fade-in-scale">
            <div className="absolute inset-0 bg-brand-500/5 animate-pulse"></div>
            <Award className="w-12 h-12 text-amber-400 mx-auto animate-bounce mb-3" />
            <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">
              Milestone Unlocked!
            </h2>
            <p className="text-sm text-brand-400 font-semibold mb-1">{congratsBadge}</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Congratulations! Your continuous ecological tracking helps reduce real carbon
              footprint offsets daily.
            </p>
          </div>
        )}

        {/* Floating XP Point notifications */}
        {floatingPoints && (
          <div className="fixed bottom-8 right-8 z-50 bg-amber-500 text-slate-950 font-display font-extrabold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in-up">
            <Trophy className="w-5 h-5 animate-spin" />
            <span>+{floatingPoints} XP Earned!</span>
          </div>
        )}

        {/* Initial session-restore loading state (prevents a blank screen) */}
        {loadingSession && (
          <div
            className="flex flex-col items-center justify-center py-32 text-slate-400"
            role="status"
            aria-live="polite"
          >
            <Sprout className="w-10 h-10 text-emerald-400 animate-pulse mb-3" aria-hidden="true" />
            <p className="text-sm font-display">Loading CarbonSync…</p>
          </div>
        )}

        {/* Unauthenticated Landing Experience */}
        {!userProfile && !loadingSession && (
          <LandingPage
            authMode={authMode}
            setAuthMode={setAuthMode}
            authName={authName}
            setAuthName={setAuthName}
            authEmail={authEmail}
            setAuthEmail={setAuthEmail}
            authPassword={authPassword}
            setAuthPassword={setAuthPassword}
            authAvatar={authAvatar}
            setAuthAvatar={setAuthAvatar}
            authError={authError}
            setAuthError={setAuthError}
            authSubmitting={authSubmitting}
            onRegister={handleRegister}
            onLogin={handleLogin}
          />
        )}

        {/* Dashboard Panels */}
        {userProfile && (
          <Dashboard
            profile={userProfile}
            emissionsLogs={emissionsLogs}
            leaderboard={leaderboard}
            milestones={milestones}
            simulatedSensors={simulatedSensors}
            onLogActivity={logCarbonSavingActivity}
            onDeleteLog={handleDeleteLogEntry}
            onToggle={updateToggle}
            onCheer={handleTriggerCheer}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-6 bg-slate-950 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <div>
            <p>
              © 2026 CarbonSync. Local-first — your account data stays in the app's own database.
            </p>
            <p className="text-[10px] text-slate-600 mt-1">
              Simulated IoT meters operate on dynamic offset margins compared against standard
              petrol equivalent loads.
            </p>
          </div>
          <div className="flex gap-4">
            <a
              href="#simulator_container"
              className="hover:text-slate-300 transition-all font-mono"
            >
              Telemetry
            </a>
            <span>•</span>
            <a href="#ai_coaching_widget" className="hover:text-slate-300 transition-all font-mono">
              Gemini Insights
            </a>
            <span>•</span>
            <span className="text-[9px] uppercase font-mono font-bold text-slate-600 bg-slate-900/30 px-2 py-0.5 rounded border border-slate-900">
              UTC System Time: 2026-06-19
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
