import { useState } from "react";
import {
  Users,
  Award,
  Share2,
  Sparkles,
  MessageSquare,
  Heart,
  Check,
  Copy,
  Trophy,
  Flame,
  Leaf,
  ThumbsUp,
} from "lucide-react";
import { LeaderboardEntry, UserProfile } from "../types";
import AvatarIcon from "./AvatarIcon";

interface CommunityLeaderboardProps {
  currentUserId: string;
  leaderboard: LeaderboardEntry[];
  userProfile: UserProfile | null;
  onTriggerCheer: (targetUserId: string, name: string) => void;
}

export default function CommunityLeaderboard({
  currentUserId,
  leaderboard,
  userProfile,
  onTriggerCheer,
}: CommunityLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "share">("leaderboard");
  const [sharingPlatform, setSharingPlatform] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [socialFeed, setSocialFeed] = useState<
    Array<{
      id: string;
      user: string;
      text: string;
      likes: number;
      savedRaw: number;
      liked?: boolean;
    }>
  >([
    {
      id: "feed_1",
      user: "Beatrix ClimateHero",
      text: "Just completed a 1-day eco shift using Transit Tracker! Saved over 12.5 kg of CO2 equivalent in my daily commute today!",
      likes: 24,
      savedRaw: 12.5,
    },
    {
      id: "feed_2",
      user: "Clara Greenleaf",
      text: "My Smart Utility Meter logged a peak solar grid offset of 3.2kWh today! Passively contributing to the neighborhood grid!",
      likes: 18,
      savedRaw: 3.2,
    },
  ]);
  const [customPost, setCustomPost] = useState<string>("");

  const handleShareClick = (platform: string) => {
    setSharingPlatform(platform);
    setTimeout(() => {
      setSharingPlatform("");
    }, 2500);
  };

  const copyStatsToClipboard = () => {
    if (!userProfile) return;
    const shareMessage = `Carbon Footprint Impact Metrics:
User: ${userProfile.name}
Total Carbon Offset Saved: ${userProfile.totalSavedKg.toFixed(1)} kg CO2
Gamified Level Score: ${userProfile.points} Points
Active Eco Streak: ${userProfile.streakDays} Days!
Join me to reduce our emissions! @CarbonSync`;

    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publishToFeed = () => {
    if (!userProfile) return;
    if (!customPost.trim()) return;

    const newPost = {
      id: `post_${Date.now()}`,
      user: userProfile.name,
      text: customPost,
      likes: 1,
      savedRaw: userProfile.totalSavedKg,
      liked: true,
    };
    setSocialFeed([newPost, ...socialFeed]);
    setCustomPost("");
  };

  const handleLikePost = (id: string) => {
    setSocialFeed(
      socialFeed.map((post) => {
        if (post.id === id) {
          return {
            ...post,
            likes: post.liked ? post.likes - 1 : post.likes + 1,
            liked: !post.liked,
          };
        }
        return post;
      })
    );
  };

  return (
    <div className="glass rounded-2xl p-6 relative overflow-hidden transition-all duration-300">
      {/* Header Tabs */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          <h3 className="font-display font-bold text-lg text-white">Community & Sharing</h3>
        </div>
        <div className="flex gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`px-3 py-1 rounded text-xs font-display font-medium transition-all cursor-pointer ${
              activeTab === "leaderboard"
                ? "bg-emerald-400 text-emerald-950 font-bold"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Rankings
          </button>
          <button
            onClick={() => setActiveTab("share")}
            className={`px-3 py-1 rounded text-xs font-display font-medium transition-all cursor-pointer ${
              activeTab === "share"
                ? "bg-emerald-400 text-emerald-950 font-bold"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Social Hub
          </button>
        </div>
      </div>

      <div>
        {activeTab === "leaderboard" ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center text-xs text-slate-400 font-medium px-2">
              <span>Eco Competitor</span>
              <div className="flex gap-8 font-mono">
                <span>Carbon Saved</span>
                <span>Eco Points</span>
              </div>
            </div>

            {/* List entries */}
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {leaderboard.map((player, idx) => {
                const isMe = player.userId === currentUserId;
                const renderRankBadge = (rankIdx: number) => {
                  switch (rankIdx) {
                    case 0:
                      return (
                        <Trophy className="w-4 h-4 text-amber-400 mx-auto" aria-label="1st place" />
                      );
                    case 1:
                      return (
                        <Trophy className="w-4 h-4 text-slate-300 mx-auto" aria-label="2nd place" />
                      );
                    case 2:
                      return (
                        <Trophy className="w-4 h-4 text-amber-600 mx-auto" aria-label="3rd place" />
                      );
                    default:
                      return (
                        <span className="font-mono text-xs text-slate-400">#{rankIdx + 1}</span>
                      );
                  }
                };

                return (
                  <div
                    key={player.userId}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isMe
                        ? "border-emerald-500/30 bg-emerald-500/10 shadow-lg shadow-emerald-500/5"
                        : "border-white/5 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank Indicator */}
                      <span className="font-mono text-sm font-bold w-6 text-slate-400 text-center flex items-center justify-center">
                        {renderRankBadge(idx)}
                      </span>

                      {/* Avatar & Info */}
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-white/10 rounded-lg flex items-center justify-center">
                          <AvatarIcon avatar={player.avatar} />
                        </span>
                        <div>
                          <span
                            className={`text-sm font-medium ${isMe ? "text-emerald-300 font-bold" : "text-white"}`}
                          >
                            {player.name} {isMe && "(You)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 font-mono text-sm font-bold">
                      <span className="text-blue-300">
                        {player.totalSavedKg.toFixed(1)}{" "}
                        <span className="text-[10px] text-slate-400">kg</span>
                      </span>
                      <span className="text-amber-400 w-16 text-right">
                        +{player.points} <span className="text-[10px] text-slate-400">XP</span>
                      </span>

                      {/* Cheer action for community engagement */}
                      {!isMe && (
                        <button
                          onClick={() => onTriggerCheer(player.userId, player.name)}
                          className="bg-emerald-400/10 text-emerald-300 p-2 rounded-lg border border-emerald-400/20 text-xs hover:bg-emerald-400 hover:text-emerald-950 transition-all cursor-pointer flex items-center justify-center"
                          title="Send supportive cheer"
                          aria-label={`Send a supportive eco cheer to ${player.name}`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-2 border-t border-white/10">
              <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Leaderboard standings update from the local activity ledger. Track savings daily to
                climb your division rank!
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {/* Social Share Engine Graphic card mockup */}
            {userProfile && (
              <div className="relative border border-white/10 bg-white/5 rounded-2xl p-4 overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none"></div>

                {/* Meta details */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/10 text-emerald-400 p-1.5 rounded-lg">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-display font-medium text-slate-300">
                        Carbon Savings Passport
                      </h4>
                      <p className="text-[10px] text-slate-400">Your shareable impact card</p>
                    </div>
                  </div>
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/20 text-[9px] font-mono font-bold px-2.5 py-1 rounded-full animate-pulse">
                    LEVEL SCORE COMPILATION
                  </span>
                </div>

                {/* Main achievement card layout */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center relative backdrop-blur-md">
                  <div className="flex justify-center mb-2">
                    <Leaf className="w-8 h-8 text-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-xs text-emerald-300 font-medium font-mono">
                    CARBON OFFSET OFFICIALLY LOGGED
                  </p>
                  <p className="text-3xl font-display font-extrabold text-emerald-300 tracking-tight my-1.5">
                    {userProfile.totalSavedKg.toFixed(1)}{" "}
                    <span className="text-sm font-sans text-slate-300">kg CO₂ Saved</span>
                  </p>

                  {/* Minimal statistics row */}
                  <div className="grid grid-cols-2 mt-4 pt-3 border-t border-white/10 text-left">
                    <div className="border-r border-white/10 pr-2 flex items-center gap-1">
                      <Flame className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <span className="text-[9px] block text-slate-400 uppercase font-mono">
                          Streak Power
                        </span>
                        <span className="text-sm font-bold text-amber-400 font-mono">
                          {userProfile.streakDays} Days active
                        </span>
                      </div>
                    </div>
                    <div className="pl-3 flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="text-[9px] block text-slate-400 uppercase font-mono">
                          Points Bounty
                        </span>
                        <span className="text-sm font-bold text-slate-100 font-mono">
                          {userProfile.points} XP Gained
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Share action buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={copyStatsToClipboard}
                    className="flex-1 bg-white/10 hover:bg-white/20 hover:text-white text-slate-100 text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all font-display font-bold cursor-pointer border border-white/5"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Stats Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Raw Card
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleShareClick("Twitter")}
                    className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all font-display font-bold cursor-pointer border border-blue-500/10"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share to X / Feed
                  </button>
                </div>

                {/* Action Alert notification */}
                {sharingPlatform && (
                  <div className="absolute inset-x-0 bottom-0 py-2.5 bg-emerald-500 text-emerald-950 font-bold text-[10px] text-center font-display tracking-wider animate-fade-in-up">
                    SUCCESSFULLY EXPORTED TO {sharingPlatform.toUpperCase()}
                  </div>
                )}
              </div>
            )}

            {/* Simulated Community Social Posting stream */}
            <div className="space-y-3.5 pt-2 border-t border-white/10">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Active Community Log Feed
              </span>

              {/* Creator entry */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Share a carbon saving thought or tip..."
                  value={customPost}
                  onChange={(e) => setCustomPost(e.target.value)}
                  aria-label="Share a carbon saving thought or tip"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/50 focus:bg-slate-950/40 transition-all font-sans"
                />
                <button
                  onClick={publishToFeed}
                  className="bg-emerald-400 text-emerald-950 font-display font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-300 transition-all cursor-pointer"
                >
                  Publish
                </button>
              </div>

              {/* Live social entries list */}
              <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                {socialFeed.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-emerald-300">{post.user}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ✨ savings: {post.savedRaw.toFixed(1)} kg
                      </span>
                    </div>
                    <p className="text-slate-200 leading-relaxed">{post.text}</p>
                    <div className="mt-2.5 flex items-center gap-4 text-[10px] text-slate-400">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className={`flex items-center gap-1 hover:text-red-400 transition-all cursor-pointer ${post.liked ? "text-red-400 font-medium" : ""}`}
                        aria-label={
                          post.liked
                            ? `Remove your cheer from ${post.user}'s post`
                            : `Cheer ${post.user}'s post`
                        }
                        aria-pressed={post.liked}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${post.liked ? "fill-red-400 shrink-0 text-red-400" : "shrink-0"}`}
                          aria-hidden="true"
                        />{" "}
                        {post.likes} Cheers
                      </button>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" /> Reply
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
