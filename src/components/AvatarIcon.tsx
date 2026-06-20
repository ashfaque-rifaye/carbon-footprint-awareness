import { Sprout, Globe, Bike, Zap, Leaf } from "lucide-react";

/**
 * Render the icon for a user's chosen avatar. Single source of truth shared by the
 * header and the leaderboard so the avatar→icon mapping lives in exactly one place.
 */
export default function AvatarIcon({
  avatar,
  className = "w-4 h-4",
}: {
  avatar: string;
  className?: string;
}) {
  const a = (avatar || "").toLowerCase();
  if (a.includes("sprout") || a.includes("🌱"))
    return <Sprout className={`${className} text-emerald-400`} aria-hidden="true" />;
  if (a.includes("globe") || a.includes("🌍"))
    return <Globe className={`${className} text-blue-400`} aria-hidden="true" />;
  if (a.includes("bike") || a.includes("🚲"))
    return <Bike className={`${className} text-indigo-400`} aria-hidden="true" />;
  if (a.includes("zap") || a.includes("⚡") || a.includes("energy"))
    return <Zap className={`${className} text-amber-400`} aria-hidden="true" />;
  return <Leaf className={`${className} text-emerald-500`} aria-hidden="true" />;
}
