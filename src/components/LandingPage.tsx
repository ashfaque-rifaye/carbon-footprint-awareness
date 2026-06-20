import React from "react";
import {
  Sparkles, ArrowRight, Bot, ShieldCheck, Cpu, Globe, Leaf, TrendingDown, Trophy,
  Flame, Sprout, Zap, Compass, BarChart3, Target, MessageSquare, Check, ShieldAlert, Bike,
} from "lucide-react";
import EcoAssistant from "./EcoAssistant";

export type AuthMode = "login" | "register";
export type AvatarKey = "sprout" | "globe" | "leaf" | "bike";

interface LandingPageProps {
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  authName: string;
  setAuthName: (v: string) => void;
  authEmail: string;
  setAuthEmail: (v: string) => void;
  authPassword: string;
  setAuthPassword: (v: string) => void;
  authAvatar: AvatarKey;
  setAuthAvatar: (v: AvatarKey) => void;
  authError: string;
  setAuthError: (v: string) => void;
  authSubmitting: boolean;
  onRegister: (e: React.FormEvent) => void;
  onLogin: (e: React.FormEvent) => void;
}

const AVATAR_OPTIONS: { key: AvatarKey; label: string; icon: React.ReactNode }[] = [
  { key: "sprout", label: "Sprout", icon: <Sprout className="w-4 h-4 text-emerald-400" aria-hidden="true" /> },
  { key: "globe", label: "Globe", icon: <Globe className="w-4 h-4 text-blue-400" aria-hidden="true" /> },
  { key: "leaf", label: "Leaf", icon: <Leaf className="w-4 h-4 text-teal-400" aria-hidden="true" /> },
  { key: "bike", label: "Cycle", icon: <Bike className="w-4 h-4 text-amber-400" aria-hidden="true" /> },
];

const FEATURES = [
  { icon: <Bot className="w-6 h-6 text-emerald-400" aria-hidden="true" />, title: "Conversational AI Coach", body: "Chat with a Gemini-powered assistant for personalized, real-world advice grounded in your own activity." },
  { icon: <Sparkles className="w-6 h-6 text-purple-400" aria-hidden="true" />, title: "Smart Insights Engine", body: "Get auto-generated optimization paths and claimable challenges based on your live telemetry and logs." },
  { icon: <Zap className="w-6 h-6 text-amber-400" aria-hidden="true" />, title: "Smart Meter Integration", body: "Simulated IoT utility meter logs passive solar offsets automatically when clean energy exceeds demand." },
  { icon: <Compass className="w-6 h-6 text-blue-400" aria-hidden="true" />, title: "Multi-Modal Transport", body: "Track walking, cycling, transit, and EV journeys with granular savings vs. a petrol baseline." },
  { icon: <Trophy className="w-6 h-6 text-emerald-300" aria-hidden="true" />, title: "Gamified Milestones", body: "Build streaks, unlock badges, climb the community leaderboard, and share your wins." },
  { icon: <BarChart3 className="w-6 h-6 text-teal-400" aria-hidden="true" />, title: "Carbon Audit Ledger", body: "A real-time history of every saving, stored in your own private local database." },
];

const HOW_IT_WORKS = [
  { step: "01", icon: <Target className="w-5 h-5 text-emerald-400" aria-hidden="true" />, title: "Log your actions", body: "Complete daily challenges or record custom offsets across energy, transport, diet, and waste." },
  { step: "02", icon: <Cpu className="w-5 h-5 text-emerald-400" aria-hidden="true" />, title: "Sync & automate", body: "Connect simulated smart-home and transport trackers that generate carbon credits passively." },
  { step: "03", icon: <MessageSquare className="w-5 h-5 text-emerald-400" aria-hidden="true" />, title: "Get AI guidance", body: "Receive personalized insights and chat with your coach to keep improving week after week." },
];

const HERO_STATS = [
  { label: "CO₂ Saved", value: "128.4", unit: "kg", color: "text-emerald-400", icon: <TrendingDown className="w-4 h-4" aria-hidden="true" /> },
  { label: "Eco Points", value: "2,310", unit: "XP", color: "text-amber-400", icon: <Trophy className="w-4 h-4" aria-hidden="true" /> },
  { label: "Day Streak", value: "14", unit: "days", color: "text-red-400", icon: <Flame className="w-4 h-4" aria-hidden="true" /> },
  { label: "Trees Equiv.", value: "5.8", unit: "trees", color: "text-blue-400", icon: <Sprout className="w-4 h-4" aria-hidden="true" /> },
];

/**
 * Public, unauthenticated landing experience: hero, live AI-coach demo, feature
 * grid, "how it works", and the login/register form. Purely presentational — all
 * auth state and submit handlers are owned by the parent and passed in as props.
 */
export default function LandingPage({
  authMode, setAuthMode,
  authName, setAuthName,
  authEmail, setAuthEmail,
  authPassword, setAuthPassword,
  authAvatar, setAuthAvatar,
  authError, setAuthError,
  authSubmitting,
  onRegister, onLogin,
}: LandingPageProps) {
  return (
    <div className="space-y-16 md:space-y-24 pb-8">

      {/* HERO */}
      <section className="grid lg:grid-cols-2 gap-10 items-center pt-4 md:pt-8">
        <div className="space-y-6 text-center lg:text-left animate-fade-in-up">
          <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-mono font-semibold px-3.5 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> AI-Powered Carbon Coach
          </span>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl xl:text-6xl text-white tracking-tight leading-[1.05]">
            Understand, track, and <span className="text-emerald-400">cut your carbon</span> footprint.
          </h2>
          <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            CarbonSync turns everyday choices into measurable climate impact. Log simple
            actions, sync simulated smart-home and transport telemetry, and get personalized
            guidance from a conversational AI coach powered by Google Gemini.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
            <a
              href="#get-started"
              onClick={() => setAuthMode("register")}
              className="px-6 py-3 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-display font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              Start tracking free <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            <a
              href="#ai-demo"
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-display font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <Bot className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Try the AI coach
            </a>
          </div>
          <div className="flex items-center gap-5 justify-center lg:justify-start pt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Privacy-first</span>
            <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Gemini AI</span>
            <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Local-first storage</span>
          </div>
        </div>

        {/* Hero visual: impact stats card */}
        <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden animate-fade-in-scale">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-400 rounded-xl">
                <Leaf className="w-5 h-5 text-emerald-950" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-white font-display font-bold">Your Impact Dashboard</p>
                <p className="text-[10px] text-emerald-300/70 font-mono">live preview</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">DEMO</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className={`${s.color} mb-2 inline-flex`}>{s.icon}</span>
                <p className="text-[10px] text-slate-400 uppercase font-mono">{s.label}</p>
                <p className={`font-display font-extrabold text-2xl ${s.color} font-mono leading-tight`}>
                  {s.value} <span className="text-[11px] text-slate-500 font-sans">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-3.5 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-pulse" aria-hidden="true" />
            <p className="text-[11px] text-slate-300 leading-relaxed">
              <span className="text-emerald-300 font-semibold">AI tip:</span> Shifting laundry to
              midday solar hours could save you ~1.2 kg CO₂ this week.
            </p>
          </div>
        </div>
      </section>

      {/* IMPACT BAR */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { value: "4", label: "Tracked categories", sub: "energy · transport · diet · waste" },
          { value: "24/7", label: "IoT telemetry", sub: "simulated smart devices" },
          { value: "AI", label: "Personalized coaching", sub: "powered by Gemini" },
          { value: "100%", label: "Privacy-first", sub: "your data stays yours" },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-2xl p-5 text-center">
            <p className="font-display font-extrabold text-2xl md:text-3xl text-emerald-400">{stat.value}</p>
            <p className="text-xs text-white font-semibold mt-1">{stat.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </section>

      {/* AI ASSISTANT LIVE DEMO */}
      <section id="ai-demo" className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-2 text-emerald-300 text-xs font-mono font-semibold uppercase tracking-wider">
            <Bot className="w-4 h-4" aria-hidden="true" /> Meet your coach
          </span>
          <h3 className="font-display font-extrabold text-2xl md:text-3xl text-white tracking-tight">
            Ask the AI anything about going greener
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            No sign-up required. Try the live conversational assistant below — it gives
            practical, context-aware advice and rough CO₂ estimates on demand.
          </p>
        </div>
        <div className="max-w-2xl mx-auto">
          <EcoAssistant variant="compact" />
        </div>
      </section>

      {/* FEATURES */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h3 className="font-display font-extrabold text-2xl md:text-3xl text-white tracking-tight">
            Everything you need to reduce your footprint
          </h3>
          <p className="text-sm text-slate-400">
            Practical tools, smart automation, and motivation that actually sticks.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 hover:border-emerald-500/25 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                {f.icon}
              </div>
              <h4 className="font-display font-bold text-white text-base mb-1.5">{f.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h3 className="font-display font-extrabold text-2xl md:text-3xl text-white tracking-tight">How it works</h3>
          <p className="text-sm text-slate-400">Three simple steps to a lighter footprint.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.step} className="relative glass rounded-2xl p-6">
              <span className="font-display font-extrabold text-4xl text-white/10 absolute top-4 right-5">{s.step}</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                {s.icon}
              </div>
              <h4 className="font-display font-bold text-white text-base mb-1.5">{s.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{s.body}</p>
              {i < 2 && (
                <ArrowRight className="hidden md:block w-5 h-5 text-slate-700 absolute -right-3.5 top-1/2 -translate-y-1/2 z-10" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* GET STARTED / AUTH */}
      <section id="get-started" className="grid lg:grid-cols-2 gap-8 items-center scroll-mt-24">
        <div className="space-y-5 text-center lg:text-left">
          <h3 className="font-display font-extrabold text-2xl md:text-3xl text-white tracking-tight">
            {authMode === "register" ? "Ready to start? Create your free account" : "Welcome back"}
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto lg:mx-0">
            Your progress, achievements, and carbon ledger are saved to a private
            local database on the server, secured behind your own password — so you can
            pick up right where you left off.
          </p>
          <ul className="space-y-2.5 text-sm text-slate-300 max-w-md mx-auto lg:mx-0 text-left">
            {[
              "Personalized AI coaching from day one",
              "Simple, secure email + password login",
              "Gamified streaks, badges, and leaderboard",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="max-w-md w-full mx-auto space-y-5">
          <form
            onSubmit={authMode === "register" ? onRegister : onLogin}
            className="glass rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display font-bold text-white text-base">
              {authMode === "register" ? "Create your eco account" : "Sign in to your account"}
            </h3>

            {authMode === "register" && (
              <div className="space-y-1">
                <label htmlFor="auth-name" className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">Full Name</label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="e.g. Ashfaque Rifaye"
                  className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="auth-email" className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">Email Address</label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="e.g. user@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="auth-password" className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">Password</label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={authMode === "register" ? 8 : undefined}
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder={authMode === "register" ? "At least 8 characters" : "Your password"}
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            {/* Avatar select (registration only) */}
            {authMode === "register" && (
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">Choose your avatar</span>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((av) => (
                    <button
                      key={av.key}
                      type="button"
                      aria-pressed={authAvatar === av.key}
                      aria-label={`Select ${av.label} avatar`}
                      onClick={() => setAuthAvatar(av.key)}
                      className={`p-2.5 flex flex-col items-center justify-center border rounded-xl gap-1.5 transition-all cursor-pointer ${
                        authAvatar === av.key
                          ? "bg-slate-800 border-emerald-500 shadow-md text-white"
                          : "bg-slate-950/40 border-white/10 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                      }`}
                    >
                      {av.icon}
                      <span className="text-[9px] font-medium block">{av.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inline auth error */}
            {authError && (
              <p role="alert" className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              aria-busy={authSubmitting}
              className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 disabled:cursor-not-allowed text-emerald-950 font-display font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/15 cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {authSubmitting
                ? (authMode === "register" ? "Creating account…" : "Signing in…")
                : (
                  <>
                    {authMode === "register" ? "Create account" : "Sign in"} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
            </button>

            <div className="flex items-center gap-3 py-0.5">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-[10px] font-mono uppercase text-slate-500">or</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            <button
              type="button"
              onClick={() => { setAuthError(""); setAuthMode(authMode === "register" ? "login" : "register"); }}
              className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 font-display font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {authMode === "register"
                ? "Already have an account? Log in"
                : "New here? Create an account"}
            </button>
          </form>
          <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            Passwords hashed with scrypt · Private local SQLite storage
          </p>
        </div>
      </section>
    </div>
  );
}
