import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Sparkles, User as UserIcon, AlertCircle } from "lucide-react";
import type { UserProfile } from "../types";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

interface EcoAssistantProps {
  userProfile?: UserProfile | null;
  /** Compact variant is used on the public landing page. */
  variant?: "full" | "compact";
}

const STARTER_PROMPTS = [
  "How can I cut my commute emissions?",
  "What's the carbon impact of eating beef?",
  "Give me 3 quick wins to lower my footprint",
  "How much CO₂ does a 15 km car trip make?",
];

/**
 * Lightweight Markdown renderer for assistant replies: handles headings, bullet
 * lists, and **bold** inline emphasis. Kept dependency-free and safe (text only,
 * never executes HTML).
 */
function renderMarkdown(text: string) {
  return text.split("\n\n").map((chunk, i) => {
    const trimmed = chunk.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("### ")) {
      return <h4 key={i} className="font-display font-bold text-white text-sm pt-1">{renderInline(trimmed.slice(4))}</h4>;
    }
    if (trimmed.startsWith("## ")) {
      return <h3 key={i} className="font-display font-bold text-white text-base pt-1">{renderInline(trimmed.slice(3))}</h3>;
    }
    if (/^(\*|-)\s/.test(trimmed)) {
      return (
        <ul key={i} className="list-disc pl-5 space-y-1">
          {trimmed.split("\n").map((li, j) => (
            <li key={j}>{renderInline(li.replace(/^(\*|-)\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{renderInline(trimmed)}</p>;
  });
}

/** Render **bold** segments inside a line of text. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-emerald-300 font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export default function EcoAssistant({ userProfile, variant = "full" }: EcoAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      text:
        "Hi! I'm your **Eco Assistant** 🌱. Ask me anything about reducing your carbon footprint — transport, energy, food, or waste — and I'll give you practical, personalized tips.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const history: ChatMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Drop the seeded greeting so the model only sees real conversation.
          messages: history.filter((m, i) => !(i === 0 && m.role === "model")),
          userProfile: userProfile
            ? {
                name: userProfile.name,
                points: userProfile.points,
                totalSavedKg: userProfile.totalSavedKg,
                streakDays: userProfile.streakDays,
                smartMeterConnected: userProfile.smartMeterConnected,
                transportTrackerConnected: userProfile.transportTrackerConnected,
              }
            : undefined,
        }),
      });

      if (!res.ok) throw new Error("chat request failed");
      const data = await res.json();
      setOffline(data.source === "fallback");
      setMessages((prev) => [...prev, { role: "model", text: data.reply || "Sorry, I couldn't generate a reply." }]);
    } catch {
      setOffline(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text:
            "I'm having trouble reaching the AI service right now. In the meantime: focus on transport (walk/cycle short trips), energy (run appliances in daylight), and diet (a couple of plant-based days a week) for the biggest quick wins.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const heightClass = variant === "compact" ? "h-[300px]" : "h-[420px]";

  return (
    <div className="glass rounded-2xl p-5 sm:p-6 relative overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-500/15 p-2 rounded-xl text-emerald-300 border border-emerald-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base sm:text-lg text-white">Eco Assistant</h3>
            <p className="text-[11px] text-emerald-200/60 flex items-center gap-1">
              <Sparkles className="w-3 h-3" aria-hidden="true" /> Conversational AI coach · Gemini
            </p>
          </div>
        </div>
        {offline && (
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
            <AlertCircle className="w-3 h-3" aria-hidden="true" /> Offline tips
          </span>
        )}
      </div>

      {/* Message stream */}
      <div
        ref={scrollRef}
        className={`flex-1 ${heightClass} overflow-y-auto pr-1 space-y-4`}
        role="log"
        aria-live="polite"
        aria-label="Eco Assistant conversation"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span
              className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                m.role === "user" ? "bg-blue-500/15 text-blue-300" : "bg-emerald-500/15 text-emerald-300"
              }`}
              aria-hidden="true"
            >
              {m.role === "user" ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </span>
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed space-y-2 ${
                m.role === "user"
                  ? "bg-blue-500/15 text-blue-50 border border-blue-500/20"
                  : "bg-white/5 text-slate-200 border border-white/10"
              }`}
            >
              {renderMarkdown(m.text)}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-300" aria-hidden="true">
              <Bot className="w-3.5 h-3.5" />
            </span>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Starter prompts (only before the user has asked anything) */}
      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-1.5 pt-3 animate-fadeIn">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => sendMessage(p)}
              className="text-[10.5px] text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-full px-3 py-1.5 transition-all cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex gap-2 pt-3 mt-2 border-t border-white/10"
      >
        <label htmlFor="eco-assistant-input" className="sr-only">
          Ask the Eco Assistant a question
        </label>
        <input
          id="eco-assistant-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about cutting your carbon footprint..."
          disabled={loading}
          className="flex-1 bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/60 focus:bg-slate-950/90 transition-all disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-display font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}
