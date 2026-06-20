/** Low-carbon transit modes supported by the transport tracker simulator. */
export type TransitMode = "walk" | "electric_scooter" | "bike" | "train" | "ev";

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  points: number;
  totalSavedKg: number;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  avatar: string; // e.g. "leaf", "globe", "zap", "sprout"
  smartMeterConnected: boolean; // Virtual tracking toggle
  transportTrackerConnected: boolean; // Virtual tracking toggle
  createdAt: string;
}

export interface EmissionsLog {
  logId: string;
  userId: string;
  category: "transport" | "energy" | "diet" | "waste";
  kgSaved: number;
  activityName: string;
  timestamp: string; // ISO String
  source: "manual" | "smart_meter" | "transport_tracker";
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: "transport" | "energy" | "diet" | "waste";
  kgSaved: number;
  points: number;
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  points: number;
  totalSavedKg: number;
  avatar: string;
}

export interface Milestone {
  id: string;
  title: string;
  requirement: string;
  pointsRequired: number;
  badge: string; // icon name or emoji
  unlocked: boolean;
}

// Pre-defined static challenges available globally
export const STATIC_CHALLENGES: Challenge[] = [
  {
    id: "diet_plant",
    title: "1-Day Vegan Challenge",
    description: "Prepare and consume entirely plant-based meals for full 24 hours.",
    category: "diet",
    kgSaved: 2.5,
    points: 80,
    difficulty: "Easy",
  },
  {
    id: "trans_bike",
    title: "Eco Commuting Ride",
    description: "Replace petrol mileage with a bicycle ride, skateboard or micro-scooter.",
    category: "transport",
    kgSaved: 4.2,
    points: 120,
    difficulty: "Medium",
  },
  {
    id: "energy_power_down",
    title: "Vigilant Phantom Shutdown",
    description: "Locate and completely unplug 5 vampire-load power bricks overnight.",
    category: "energy",
    kgSaved: 1.5,
    points: 50,
    difficulty: "Easy",
  },
  {
    id: "waste_compost",
    title: "Zero Food Waste Champion",
    description:
      "Compost organic vegetable scraps and plan meals to leave zero edible waste today.",
    category: "waste",
    kgSaved: 1.8,
    points: 60,
    difficulty: "Easy",
  },
  {
    id: "energy_off_peak",
    title: "Smart Solar Window Alignment",
    description: "Perform laundry chores exclusively during peak regional solar output times.",
    category: "energy",
    kgSaved: 2.1,
    points: 90,
    difficulty: "Medium",
  },
  {
    id: "trans_express",
    title: "The Locomotive Transition",
    description:
      "Choose high-speed electric mass rail systems over short-distance regional flights.",
    category: "transport",
    kgSaved: 38.0,
    points: 350,
    difficulty: "Hard",
  },
];

// Achievements / Milestones threshold requirements
export const STATIC_MILESTONES: Milestone[] = [
  {
    id: "badge_sprout",
    title: "The Eco Sprout",
    requirement: "Reach 100 points",
    pointsRequired: 100,
    badge: "sprout",
    unlocked: false,
  },
  {
    id: "badge_sapling",
    title: "Carbon Guardian",
    requirement: "Reach 500 points",
    pointsRequired: 500,
    badge: "shield",
    unlocked: false,
  },
  {
    id: "badge_forest",
    title: "Forest Architect",
    requirement: "Reach 1,500 points",
    pointsRequired: 1500,
    badge: "trees",
    unlocked: false,
  },
  {
    id: "badge_net_zero",
    title: "Net Zero Envoy",
    requirement: "Reach 3,000 points",
    pointsRequired: 3000,
    badge: "zap",
    unlocked: false,
  },
  {
    id: "badge_streak_king",
    title: "Daily Guardian Hero",
    requirement: "Build a 5-day active streak",
    pointsRequired: 5000, // Or customized evaluations
    badge: "flame",
    unlocked: false,
  },
];
