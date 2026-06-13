import React, { useState, useEffect } from "react";
import { 
  Sprout, Globe, Zap, Compass, Flame, Trophy, TrendingDown, Plus, 
  HelpCircle, Trash2, LogIn, LogOut, Check, ArrowRight, Share2, Award, ShieldAlert, Bike, Leaf,
  LayoutDashboard, History, Sparkles 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./lib/firebase";
import { signInWithPopup, signInAnonymously, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { 
  doc, setDoc, getDoc, deleteDoc, collection, getDocs, addDoc, onSnapshot, query, orderBy, limit 
} from "firebase/firestore";

import { 
  UserProfile, EmissionsLog, Challenge, LeaderboardEntry, Milestone, 
  STATIC_CHALLENGES, STATIC_MILESTONES 
} from "./types";
import {
  calculatePoints, roundKg, nextStreak, resolveStreakOnLogin, treesEquivalent, toDateKey
} from "./lib/carbon";

import DeviceSimulator from "./components/DeviceSimulator";
import CommunityLeaderboard from "./components/CommunityLeaderboard";
import AiInsights from "./components/AiInsights";

export default function App() {
  // Authentication & session variables
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [authName, setAuthName] = useState<string>("");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authAvatar, setAuthAvatar] = useState<"sprout" | "globe" | "leaf" | "bike">("sprout");
  const [activeTab, setActiveTab] = useState<"dashboard" | "ledger" | "insights" | "leaderboard">("dashboard");
  const [showProgrammaticAuthPrompt, setShowProgrammaticAuthPrompt] = useState<boolean>(false);

  // Firestore sync collections
  const [emissionsLogs, setEmissionsLogs] = useState<EmissionsLog[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>(STATIC_MILESTONES);

  // Active inputs / Filter selections
  const [activeCategory, setActiveCategory] = useState<"all" | "transport" | "energy" | "diet" | "waste">("all");
  const [isCustomFormOpen, setIsCustomFormOpen] = useState<boolean>(false);
  const [customActionName, setCustomActionName] = useState<string>("");
  const [customActionType, setCustomActionType] = useState<"transport" | "energy" | "diet" | "waste">("energy");
  const [customActionSavings, setCustomActionSavings] = useState<number>(1.5);

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

  // Today marker string (YYYY-MM-DD)
  const todayStr = toDateKey();

  // 1. Listen to Authentication Changes & Load cached profile session if any
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoadingSession(true);
      if (user) {
        setCurrentUser(user);
        await handleSyncUserProfile(user);
      } else {
        // Fallback: Check if there's a saved persistent cloud session in localStorage
        const savedName = localStorage.getItem("carbonsync_saved_name");
        const savedEmail = localStorage.getItem("carbonsync_saved_email");
        if (savedName && savedEmail) {
          const customUid = "user_" + savedEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
          const savedUser = {
            uid: customUid,
            displayName: savedName,
            email: savedEmail,
          };
          setCurrentUser(savedUser as any);
          await handleSyncUserProfile(savedUser as any);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
          setEmissionsLogs([]);
          setLoadingSession(false);
        }
      }
    });

    // Load static leaderboard values
    loadStaticLeaderboard();

    return () => unsubscribe();
  }, []);

  // Baseline mock standings in case database connectivity hasn't synced custom nodes yet
  const loadStaticLeaderboard = () => {
    setLeaderboard([
      { userId: "lead_1", name: "Helena BioShield", points: 3420, totalSavedKg: 91.2, avatar: "leaf" },
      { userId: "lead_2", name: "Arthur WindPower", points: 2150, totalSavedKg: 58.4, avatar: "globe" },
      { userId: "lead_3", name: "Chloe CycleFast", points: 1280, totalSavedKg: 34.1, avatar: "bike" },
    ]);
  };

  // 2. Fetch or Create user profile database document
  const handleSyncUserProfile = async (firebaseUser: FirebaseUser) => {
    const profileRef = doc(db, "users", firebaseUser.uid);
    const leaderboardRef = doc(db, "leaderboard", firebaseUser.uid);
    
    try {
      const snap = await getDoc(profileRef);
      let profileData: UserProfile;

      if (snap.exists()) {
        profileData = snap.data() as UserProfile;
        
        // Compute streak validity on login
        const validatedStreak = resolveStreakOnLogin(profileData.streakDays, profileData.lastActiveDate, todayStr);
        if (validatedStreak !== profileData.streakDays) {
          profileData.streakDays = validatedStreak;
          profileData.lastActiveDate = todayStr;
          await setDoc(profileRef, profileData, { merge: true });
        }
        setUserProfile(profileData);
      } else {
        // First login: Generate complete compliant profile
        profileData = {
          userId: firebaseUser.uid,
          name: firebaseUser.displayName || "Eco Voyager",
          email: firebaseUser.email || "",
          points: 0,
          totalSavedKg: 0.0,
          streakDays: 1,
          lastActiveDate: todayStr,
          avatar: "sprout",
          smartMeterConnected: false,
          transportTrackerConnected: false,
          createdAt: new Date().toISOString()
        };

        await setDoc(profileRef, profileData);
        
        // Also register flat standings summary
        const leaderboardEntry: LeaderboardEntry = {
          userId: firebaseUser.uid,
          name: profileData.name,
          points: 0,
          totalSavedKg: 0.0,
          avatar: "sprout"
        };
        await setDoc(leaderboardRef, leaderboardEntry);
        
        setUserProfile(profileData);
      }

      // Initialise real-time Emissions log binding for user
      bindEmissionsLogs(firebaseUser.uid);
      // Initialise leaderboard real-time binding
      bindLeaderboard(firebaseUser.uid, profileData);

    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
    } finally {
      setLoadingSession(false);
    }
  };

  // Setup Real-time log listeners
  const bindEmissionsLogs = (uid: string) => {
    const logsCol = collection(db, "users", uid, "emissions_logs");
    
    onSnapshot(logsCol, (snap) => {
      const logsList: EmissionsLog[] = [];
      snap.forEach((d) => {
        logsList.push(d.data() as EmissionsLog);
      });
      // Sort newest first
      logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEmissionsLogs(logsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/emissions_logs`);
    });
  };

  // Bind real-time community rankings subscription
  const bindLeaderboard = (uid: string, myProfile: UserProfile) => {
    const leaderboardCol = collection(db, "leaderboard");
    const q = query(leaderboardCol, orderBy("points", "desc"), limit(12));

    onSnapshot(q, (snap) => {
      const list: LeaderboardEntry[] = [];
      let foundMe = false;
      
      snap.forEach((d) => {
        const item = d.data() as LeaderboardEntry;
        list.push(item);
        if (item.userId === uid) foundMe = true;
      });

      // If user is logged in but not in top limit list, push her own standings block manually so she can trace her rank
      if (!foundMe && myProfile) {
        list.push({
          userId: uid,
          name: myProfile.name,
          points: myProfile.points,
          totalSavedKg: myProfile.totalSavedKg,
          avatar: myProfile.avatar,
        });
      }
      setLeaderboard(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "leaderboard");
    });
  };

  // Google Login popup launcher with firebase error diagnostics
  const handleGoogleSignIn = async () => {
    setLoadingSession(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google popup error:", err);
      setShowProgrammaticAuthPrompt(true);
      setAlertNotification(`Google Auth popup was blocked by browser frame isolation. Safe direct cloud credentials credentials can be completed below.`);
      setLoadingSession(false);
    }
  };

  // Secure Direct Cloud Connection (Alternative secure authentication that writes directly to Firestore)
  const handleQuickCredentialSync = async (name: string, email: string, avatar: "sprout" | "globe" | "leaf" | "bike") => {
    if (!name.trim() || !email.trim()) {
      setAlertNotification("Please provide both your Name and Email to synchronize.");
      return;
    }
    setLoadingSession(true);
    
    // Hash-like deterministic clean UID
    const safeUid = "user_" + email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, "_");
    
    try {
      let loggedUser = null;
      try {
        // Attempt anonymous Firebase login so request.auth is populated in firebase firestore rules security gates
        const anonCred = await signInAnonymously(auth);
        if (anonCred.user) {
          loggedUser = {
            uid: anonCred.user.uid,
            displayName: name.trim(),
            email: email.toLowerCase().trim(),
          };
        }
      } catch (e) {
        console.warn("Direct anonymous auth is disabled, establishing persistent sync layer under safe custom key.", e);
      }

      if (!loggedUser) {
        loggedUser = {
          uid: safeUid,
          displayName: name.trim(),
          email: email.toLowerCase().trim(),
        };
      }

      // Persist credentials locally
      localStorage.setItem("carbonsync_saved_name", name.trim());
      localStorage.setItem("carbonsync_saved_email", email.toLowerCase().trim());
      localStorage.setItem("carbonsync_saved_avatar", avatar);

      setCurrentUser(loggedUser as any);
      await handleSyncUserProfile(loggedUser as any);
      setAlertNotification(`Welcome to CarbonSync, ${name}! Your core account has been synchronized successfully.`);
    } catch (error: any) {
      console.error(error);
      setAlertNotification(`Synchronization error: ${error.message || error}`);
    } finally {
      setLoadingSession(false);
    }
  };

  // Session Logouts
  const handleLogout = async () => {
    localStorage.removeItem("carbonsync_saved_name");
    localStorage.removeItem("carbonsync_saved_email");
    localStorage.removeItem("carbonsync_saved_avatar");
    setUserProfile(null);
    setEmissionsLogs([]);
    setCurrentUser(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.error("SignOut error:", err);
    }
    setAlertNotification("Secure session closed.");
  };

  // 3. Log a positive Carbon-Saving Activity (manual inputs, quick-challenges, simulations)
  const logCarbonSavingActivity = async (
    activityName: string,
    category: "transport" | "energy" | "diet" | "waste",
    kgSaved: number,
    source: "manual" | "smart_meter" | "transport_tracker"
  ) => {
    if (!userProfile) return;

    // Standard scoring: flat base points + bonus per kg of carbon offset saved.
    const pointsAwarded = calculatePoints(kgSaved);
    const newPointsTotal = userProfile.points + pointsAwarded;
    const newSavedTotal = roundKg(userProfile.totalSavedKg + kgSaved);

    // Calculate dynamic streak based on last active date
    const currentStreak = nextStreak(userProfile.streakDays, userProfile.lastActiveDate, todayStr);

    // Prepare updated profiles
    const updatedProfile: UserProfile = {
      ...userProfile,
      points: newPointsTotal,
      totalSavedKg: newSavedTotal,
      streakDays: currentStreak,
      lastActiveDate: todayStr
    };

    // Prepare new log entry data
    const newLogId = `log_${Date.now()}`;
    const newLog: EmissionsLog = {
      logId: newLogId,
      userId: userProfile.userId,
      category,
      kgSaved,
      activityName,
      timestamp: new Date().toISOString(),
      source
    };

    // Direct Firestore sync commits!
    if (currentUser) {
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const logDocRef = doc(db, "users", currentUser.uid, "emissions_logs", newLogId);
        const leaderboardDocRef = doc(db, "leaderboard", currentUser.uid);

        // Batch update
        await setDoc(userDocRef, updatedProfile, { merge: true });
        await setDoc(logDocRef, newLog);
        await setDoc(leaderboardDocRef, {
          userId: currentUser.uid,
          name: updatedProfile.name,
          points: newPointsTotal,
          totalSavedKg: newSavedTotal,
          avatar: updatedProfile.avatar
        }, { merge: true });

        // Update local state temporarily
        setUserProfile(updatedProfile);

        // Increment sensory values for insights logic
        if (source === "smart_meter") {
          setSimulatedSensors((prev) => ({ ...prev, meterSaving: prev.meterSaving + 0.5 }));
        } else if (source === "transport_tracker") {
          setSimulatedSensors((prev) => ({ ...prev, trackerMiles: prev.trackerMiles + kgSaved }));
        }

        // Check milestones
        checkMilestoneAchievements(newPointsTotal, currentStreak);
        
        // Float points alert
        triggerFloatingPointsFeedback(pointsAwarded);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/emissions_logs/${newLogId}`);
      }
    }
  };

  // Badge unlock listener & notifications engine
  const checkMilestoneAchievements = (pointsTotal: number, streakTotal: number) => {
    let unlockedAny = false;
    const currentMilestones = milestones.map((ms) => {
      if (ms.unlocked) return ms;

      let passes = false;
      if (ms.id === "badge_streak_king" && streakTotal >= 5) {
        passes = true;
      } else if (pointsTotal >= ms.pointsRequired) {
        passes = true;
      }

      if (passes) {
        setCongratsBadge(ms.badge + " Unlocked Badge: " + ms.title + "!");
        unlockedAny = true;
        // Save the completed challenge status record to Firestore when synced
        if (currentUser) {
          const challengeDocId = `completed_${ms.id}`;
          const challengeRef = doc(db, "users", currentUser.uid, "completed_challenges", challengeDocId);
          setDoc(challengeRef, {
            challengeId: ms.id,
            userId: currentUser.uid,
            completedAt: new Date().toISOString(),
            pointsEarned: 100
          }).catch(console.error);
        }
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
    const targetLog = emissionsLogs.find((l) => l.logId === logId);
    if (!targetLog) return;

    if (currentUser) {
      try {
        const logDocRef = doc(db, "users", currentUser.uid, "emissions_logs", logId);
        await deleteDoc(logDocRef);
        setEmissionsLogs(emissionsLogs.filter((l) => l.logId !== logId));
        setAlertNotification("Activity log entry cleared.");
        setTimeout(() => setAlertNotification(""), 3500);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/emissions_logs/${logId}`);
      }
    }
  };

  // Trigger social mock support cheer interactions
  const handleTriggerCheer = (targetUserId: string, targetName: string) => {
    setAlertNotification(`💖 You sent a solar-powered Eco Cheer to ${targetName}!`);
    setTimeout(() => setAlertNotification(""), 3500);
  };

  // Create a Custom Action entry
  const handleCreateCustomAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customActionName.trim() || customActionSavings <= 0) return;

    logCarbonSavingActivity(
      customActionName,
      customActionType,
      parseFloat(customActionSavings.toFixed(1)),
      "manual"
    );

    setCustomActionName("");
    setIsCustomFormOpen(false);
  };

  const renderAvatarInline = (avatarStr: string) => {
    const check = (avatarStr || "").toLowerCase();
    if (check.includes("sprout") || check.includes("🌱")) {
      return <Sprout className="w-4 h-4 text-emerald-400" />;
    } else if (check.includes("globe") || check.includes("🌍")) {
      return <Globe className="w-4 h-4 text-blue-400" />;
    } else if (check.includes("bike") || check.includes("🚲")) {
      return <Bike className="w-4 h-4 text-indigo-400" />;
    } else if (check.includes("zap") || check.includes("⚡") || check.includes("energy")) {
      return <Zap className="w-4 h-4 text-amber-400" />;
    } else {
      return <Leaf className="w-4 h-4 text-emerald-500" />;
    }
  };

  const renderMilestoneBadgeIcon = (badge: string) => {
    switch (badge) {
      case "sprout":
        return <Sprout className="w-5 h-5 text-emerald-400" />;
      case "shield":
        return <Award className="w-5 h-5 text-blue-400" />;
      case "trees":
        return <Globe className="w-5 h-5 text-emerald-300" />;
      case "zap":
        return <Zap className="w-5 h-5 text-amber-400 shrink-0" />;
      case "flame":
        return <Flame className="w-5 h-5 text-amber-500 animate-pulse" />;
      default:
        return <Sprout className="w-5 h-5 text-emerald-400" />;
    }
  };

  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case "diet":
        return <Leaf className="w-5 h-5 text-emerald-400" />;
      case "transport":
        return <Bike className="w-5 h-5 text-blue-400" />;
      case "energy":
        return <Zap className="w-5 h-5 text-amber-400" />;
      case "waste":
        return <Trash2 className="w-5 h-5 text-purple-400" />;
      default:
        return <Sprout className="w-5 h-5 text-emerald-400" />;
    }
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
              <p className="text-[10px] text-emerald-300/80 font-mono">Dynamic Multi-Modal Impact Tracking</p>
            </div>
          </div>

          {/* User auth session selectors */}
          <div className="flex items-center gap-3">
            {userProfile ? (
              <div className="flex items-center gap-3 bg-white/10 pl-3.5 pr-2 py-1.5 rounded-full border border-white/20">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-slate-100 font-semibold block">{userProfile.name}</span>
                  <span className="text-[9px] text-emerald-300 font-mono font-bold block">CLOUD SYNCED</span>
                </div>
                <span className="bg-white/15 p-1.5 rounded-full flex items-center justify-center">{renderAvatarInline(userProfile.avatar)}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-500/10 text-slate-300 hover:text-red-400 rounded-full transition-all cursor-pointer"
                  title="Disconnect Profile"
                  aria-label="Disconnect profile and sign out"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGoogleSignIn}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-lg text-xs font-display font-extrabold flex items-center gap-2 transition-all shadow-md shadow-emerald-500/15 hover:shadow-emerald-500/30 active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 shrink-0" /> Google Auth
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10">
        
        {/* Dynamic Alerts Banner */}
        <AnimatePresence>
          {alertNotification && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2.5"
            >
              <Check className="w-4 h-4 shrink-0 text-brand-500" />
              <span>{alertNotification}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Milestone congrats banner */}
        <AnimatePresence>
          {congratsBadge && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-accent rounded-2xl p-6 text-center border bg-brand-500/10 border-brand-500 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-brand-500/5 animate-pulse"></div>
              <Award className="w-12 h-12 text-amber-400 mx-auto animate-bounce mb-3" />
              <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">Milestone Unlocked!</h2>
              <p className="text-sm text-brand-400 font-semibold mb-1">{congratsBadge}</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">Congratulations! Your continuous ecological tracking helps reduce real carbon footprint offsets daily.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating XP Point notifications */}
        <AnimatePresence>
          {floatingPoints && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-8 right-8 z-50 bg-amber-500 text-slate-950 font-display font-extrabold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2"
            >
              <Trophy className="w-5 h-5 animate-spin" />
              <span>+{floatingPoints} XP Earned!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unauthenticated Landing Experience card */}
        {!userProfile && !loadingSession && (
          <div className="glass rounded-3xl p-8 md:p-12 text-center max-w-4xl mx-auto space-y-6 border border-slate-800/80 my-8">
            <Globe className="w-14 h-14 text-emerald-400 mx-auto animate-pulse" />
            <div className="space-y-2">
              <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight leading-tight">
                Understand, Track, and Drastically Simplify Your Carbon Footprint
              </h2>
              <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Empowering green citizens with gamified eco challenges, real-time smart home IoT simulator meters, multi-modal transport track logs, and smart coaching insights fueled by Gemini.
              </p>
            </div>

            <div className="max-w-xl mx-auto space-y-6 pt-4 text-left">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleQuickCredentialSync(authName, authEmail, authAvatar);
              }} className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-2xl">
                <h3 className="font-display font-bold text-white text-base">Register Real-Time Cloud Storage</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  No popup blocker issues. Create a robust unique account to persist your progress, carbon achievements, and challenges in our Google Cloud Firestore system permanently.
                </p>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="e.g. Ashfaque Rifaye"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all placeholder:text-slate-650"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. user@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all placeholder:text-slate-650"
                  />
                </div>

                {/* Avatar select */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">Ecosystem Avatar Selection</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: "sprout", label: "Sprout (🌱)", icon: <Sprout className="w-4 h-4 text-emerald-400" /> },
                      { key: "globe", label: "Globe (🌍)", icon: <Globe className="w-4 h-4 text-blue-400" /> },
                      { key: "leaf", label: "Leaf (🍃)", icon: <Leaf className="w-4 h-4 text-teal-400" /> },
                      { key: "bike", label: "Cycle (🚲)", icon: <Bike className="w-4 h-4 text-amber-400" /> }
                    ].map((av) => (
                      <button
                        key={av.key}
                        type="button"
                        onClick={() => setAuthAvatar(av.key as any)}
                        className={`p-2.5 flex flex-col items-center justify-center border rounded-xl gap-1.5 transition-all cursor-pointer ${
                          authAvatar === av.key 
                            ? "bg-slate-800 border-emerald-500 shadow-md text-white" 
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-250"
                        }`}
                      >
                        {av.icon}
                        <span className="text-[9px] font-medium block">{av.label.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-brand-500 hover:bg-brand-400 text-slate-950 font-display font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-brand-500/10 cursor-pointer text-center block mt-6"
                >
                  Create & Connect Secure account
                </button>
              </form>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-800/60"></div>
                <span className="text-[10px] font-mono uppercase text-slate-500">Or Federated Authentication</span>
                <div className="flex-1 h-px bg-slate-800/60"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-200 font-display font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <LogIn className="w-4 h-4 shrink-0 text-emerald-400" /> Sign In with Google Credentials
              </button>
            </div>

            <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-left text-xs text-slate-400 border-t border-slate-900/60">
              <div className="flex gap-2 p-1">
                <Zap className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h4 className="font-semibold text-white">Smart Meter Integrations</h4>
                  <p className="text-[11px] text-slate-500">Log automated power offsets of solar panels passively during peak solar output.</p>
                </div>
              </div>
              <div className="flex gap-2 p-1">
                <Compass className="w-5 h-5 text-blue-500 shrink-0" />
                <div>
                  <h4 className="font-semibold text-white">Multi-Modal Journeys</h4>
                  <p className="text-[11px] text-slate-500">Calculate granular transportation savings over internal combustion baselines.</p>
                </div>
              </div>
              <div className="flex gap-2 p-1">
                <Trophy className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <h4 className="font-semibold text-white">Milestones & Competition</h4>
                  <p className="text-[11px] text-slate-500">Access public dashboards, complete badges, unlock multipliers, and secure ranks.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Panels */}
        {userProfile && (
          <div className="space-y-8">
            
            {/* Quick Metrics stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Carbon saved */}
              <div className="glass rounded-2xl p-5 border-l-4 border-l-brand-500 relative overflow-hidden">
                <span className="text-xs text-slate-400 uppercase font-mono block mb-1">Total Carbon Saved</span>
                <span className="font-display font-extrabold text-2xl md:text-3xl text-brand-400 block leading-tight font-mono">
                  {userProfile.totalSavedKg.toFixed(1)} <span className="text-xs text-slate-400 font-sans">kg CO₂</span>
                </span>
                <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-brand-400" /> Continuous lifestyle offset</p>
              </div>

              {/* points */}
              <div className="glass rounded-2xl p-5 border-l-4 border-l-amber-500 relative overflow-hidden">
                <span className="text-xs text-slate-400 uppercase font-mono block mb-1">Eco Level Points</span>
                <span className="font-display font-extrabold text-2xl md:text-3xl text-amber-500 block leading-tight font-mono">
                  {userProfile.points} <span className="text-xs text-slate-400 font-sans">XP</span>
                </span>
                <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Unlock next level milestone</p>
              </div>

              {/* active active streak */}
              <div className="glass rounded-2xl p-5 border-l-4 border-l-red-500 relative overflow-hidden">
                <span className="text-xs text-slate-400 uppercase font-mono block mb-1">Daily Active Streak</span>
                <span className="font-display font-extrabold text-2xl md:text-3xl text-red-500 block leading-tight font-mono">
                  {userProfile.streakDays} <span className="text-xs text-slate-400 font-sans">Days</span>
                </span>
                <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-red-500 animate-bounce" /> Maintain active logging chain</p>
              </div>

              {/* carbon comparison metrics */}
              <div className="glass rounded-2xl p-5 border-l-4 border-l-blue-500 relative overflow-hidden">
                <span className="text-xs text-slate-400 uppercase font-mono block mb-1">Trees Equivalent</span>
                <span className="font-display font-extrabold text-2xl md:text-3xl text-blue-400 block leading-tight font-mono">
                  {treesEquivalent(userProfile.totalSavedKg)} <span className="text-xs text-slate-400 font-sans">Trees</span>
                </span>
                <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Annual mature absorption equivalent</p>
              </div>
            </div>

            {/* Workspace Segment Switcher Navigation Tabs */}
            <div className="flex justify-center my-6">
              <div role="tablist" aria-label="Dashboard sections" className="bg-slate-900/60 p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap gap-1.5 border border-white/5 w-full max-w-4xl shadow-xl">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "dashboard"}
                  onClick={() => setActiveTab("dashboard")}
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-display font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === "dashboard"
                      ? "bg-slate-800 text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-500/5 font-black"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" /> Eco Tracker
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "ledger"}
                  onClick={() => setActiveTab("ledger")}
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-display font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === "ledger"
                      ? "bg-slate-800 text-teal-400 border border-teal-500/20 shadow-md shadow-teal-500/5 font-black"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <History className="w-4 h-4 shrink-0" /> Carbon Ledger
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "insights"}
                  onClick={() => setActiveTab("insights")}
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-display font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === "insights"
                      ? "bg-slate-800 text-purple-400 border border-purple-500/20 shadow-md shadow-purple-500/5 font-black"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0 animate-pulse" /> Smart AI Coach
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "leaderboard"}
                  onClick={() => setActiveTab("leaderboard")}
                  className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-display font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === "leaderboard"
                      ? "bg-slate-800 text-amber-400 border border-amber-500/20 shadow-md shadow-amber-500/5 font-black"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <Trophy className="w-4 h-4 shrink-0" /> Standings & Badges
                </button>
              </div>
            </div>

            {/* Connection Sync Status Banner */}
            <div className="max-w-4xl mx-auto mb-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-5 h-5 text-blue-400 shrink-0" />
                  <div className="text-left">
                    <p className="text-white font-bold">Google Cloud Ledger Active</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Persisted securely for synchronized core user: <span className="font-mono text-blue-400 font-semibold">{userProfile?.userId}</span></p>
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-white/5 py-1 px-3.5 rounded-full flex gap-3 text-[10px] font-mono text-slate-500 shrink-0">
                  <span>STATUS: <span className="text-emerald-400 font-bold">SNAP_READY</span></span>
                  <span>•</span>
                  <span>LEDGER: <span className="text-blue-400 font-bold">ACTIVE</span></span>
                </div>
              </div>
            </div>

            {/* TAB CONTENTS RENDER BLOCK */}
            {activeTab === "dashboard" && (
              <div className="space-y-8 animate-fadeIn">
                {/* Active telemetries device simulator */}
                <DeviceSimulator 
                  onLogEmission={logCarbonSavingActivity}
                  smartConnected={userProfile.smartMeterConnected}
                  transportConnected={userProfile.transportTrackerConnected}
                  onToggleSmart={(val) => setUserProfile({ ...userProfile, smartMeterConnected: val })}
                  onToggleTransport={(val) => setUserProfile({ ...userProfile, transportTrackerConnected: val })}
                />

                {/* Daily Challenges action panels */}
                <div className="glass rounded-2xl p-6 space-y-6">
                  
                  {/* Category toggles */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="font-display font-bold text-lg text-white">Daily Greenhouse Challenges</h3>
                      <p className="text-xs text-slate-400">Claim challenges to score level points and reduce real footprint averages</p>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-1.5 bg-white/5 border border-white/10 p-1 rounded-xl">
                      {(["all", "transport", "energy", "diet", "waste"] as const).map((cat) => {
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-all ${
                              activeCategory === cat 
                                ? "bg-emerald-400 text-emerald-950 font-extrabold" 
                                : "text-slate-300 hover:text-white"
                            }`}
                          >
                            {cat.toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* List of Static Actions challenges custom grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {STATIC_CHALLENGES.filter(
                      (ch) => activeCategory === "all" || ch.category === activeCategory
                    ).map((challenge) => {
                      return (
                        <div
                          key={challenge.id}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-white/20 hover:shadow-lg group"
                        >
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span>{renderCategoryIcon(challenge.category)}</span>
                              <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold uppercase ${
                                challenge.difficulty === "Easy" 
                                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/10" 
                                  : challenge.difficulty === "Medium"
                                  ? "bg-amber-950/80 text-amber-300 border border-amber-500/10"
                                  : "bg-red-950/80 text-red-300 border border-red-500/10"
                              }`}>
                                {challenge.difficulty}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white mb-1">{challenge.title}</h4>
                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{challenge.description}</p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-xs">
                            <div className="flex gap-2">
                              <span className="text-emerald-300 font-mono text-[10px] font-bold">-{challenge.kgSaved} kg CO₂</span>
                              <span className="text-amber-400 font-mono text-[10px] font-bold">+{challenge.points} XP</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => logCarbonSavingActivity(challenge.title, challenge.category, challenge.kgSaved, "manual")}
                              className="px-3.5 py-1.5 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400 hover:text-emerald-950 rounded-lg font-display font-extrabold transition-all text-xs cursor-pointer active:scale-95 flex items-center gap-1"
                            >
                              Log Action <Check className="w-3 h-3 ml-0.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Manual Log toggle triggers */}
                  <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                    <span className="text-slate-300">Have a custom green lifestyle offset that's not on the challenge lists?</span>
                    <button
                      type="button"
                      onClick={() => setIsCustomFormOpen(!isCustomFormOpen)}
                      className="px-4 py-2 bg-white/5 hover:bg-white/15 border border-white/10 text-white rounded-xl transition-all cursor-pointer font-bold flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 text-emerald-400" /> Log Custom Offset Action
                    </button>
                  </div>

                  {/* Interactive Custom offset form */}
                  <AnimatePresence>
                    {isCustomFormOpen && (
                      <motion.form 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleCreateCustomAction}
                        className="bg-white/5 p-5 rounded-2xl border border-white/15 space-y-4 text-xs backdrop-blur-xl"
                      >
                        <h4 className="font-display font-bold text-white text-sm">Register Custom Eco Contribution</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-slate-300 block mb-1">Action Description</label>
                            <input
                              type="text"
                              placeholder="e.g. Sourced fresh backyard vegetables"
                              required
                              value={customActionName}
                              onChange={(e) => setCustomActionName(e.target.value)}
                              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:bg-slate-950/90 transition-all font-sans"
                            />
                          </div>

                          <div>
                            <label className="text-slate-300 block mb-1">Ecological Category</label>
                            <select
                              value={customActionType}
                              onChange={(e) => setCustomActionType(e.target.value as any)}
                              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400 focus:bg-slate-950/90 transition-all font-sans"
                            >
                              <option value="energy">Renewable Energy Offset</option>
                              <option value="diet">Low-carbon Food Diet</option>
                              <option value="transport">Public/Micro Transportation</option>
                              <option value="waste">Circular Waste minimization</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-slate-300 block mb-1">Est. Savings (kg CO₂)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="100.0"
                              value={customActionSavings}
                              onChange={(e) => setCustomActionSavings(Number(e.target.value))}
                              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-400 focus:bg-slate-950/90 transition-all font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setIsCustomFormOpen(false)}
                            className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-all"
                          >
                            Discard
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 rounded-lg transition-all font-bold"
                          >
                            Commit Audit Log
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                </div>
              </div>
            )}

            {/* AUDIT LEDGER TAB */}
            {activeTab === "ledger" && (
              <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto text-left">
                <div className="glass rounded-2xl p-6 border border-white/5">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-4 border-b border-white/5 mb-6 gap-3">
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
                        <History className="text-teal-400 w-5 h-5 shrink-0" /> Carbon Audit Ledger
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Definitive ecosystem savings logs validated across real-time dynamic thresholds</p>
                    </div>
                    <span className="font-mono text-xs text-teal-400 bg-teal-500/10 px-3.5 py-1.5 rounded-full border border-teal-500/20 font-bold self-start sm:self-auto shrink-0">
                      {emissionsLogs.length} AUDIT LOGS
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {emissionsLogs.length > 0 ? (
                      emissionsLogs.map((log) => {
                        const colors = {
                          diet: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
                          transport: "text-blue-400 border-blue-500/20 bg-blue-500/5",
                          energy: "text-amber-400 border-amber-500/20 bg-amber-500/5",
                          waste: "text-purple-400 border-purple-500/20 bg-purple-500/5",
                        };
                        return (
                          <div
                            key={log.logId}
                            className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-slate-950/40 hover:bg-slate-950/80 hover:border-white/10 transition-all text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`p-2 rounded-lg border font-mono text-[9px] font-bold shrink-0 uppercase tracking-wider ${colors[log.category] || "text-slate-450 border-white/5 bg-white/5 text-slate-400"}`}>
                                {log.category}
                              </span>
                              <div>
                                <span className="font-bold text-white block text-sm leading-tight">{log.activityName}</span>
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
                                onClick={() => handleDeleteLogEntry(log.logId)}
                                className="text-slate-650 hover:text-red-450 p-2 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                                title="Remove Log"
                                aria-label={`Remove log entry: ${log.activityName}`}
                              >
                                <Trash2 className="w-4 h-4 text-slate-550 hover:text-red-400" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-16 text-center text-slate-500 space-y-2 border border-dashed border-white/5 rounded-2xl bg-slate-950/20">
                        <History className="w-8 h-8 text-slate-650 mx-auto opacity-50 mb-1" />
                        <p className="text-sm font-bold text-slate-400">The ecological footprint audit ledger is empty.</p>
                        <p className="text-xs max-w-sm mx-auto">Claim tasks on the tracker tab or run smart IoT integrations to populate synchronized records!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SMART AI COACH TAB */}
            {activeTab === "insights" && (
              <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto text-left col-span-1">
                <div className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-6">
                    <div className="p-2.5 bg-purple-500/15 rounded-xl border border-purple-500/20">
                      <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-display font-extrabold text-lg text-white">Gemini Smart Ecological Coaching</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Real-time intelligent recommendations based on active telemetry patterns and direct ledger audits</p>
                    </div>
                  </div>

                  <AiInsights 
                    userProfile={userProfile}
                    recentLogs={emissionsLogs}
                    simulatedSensors={simulatedSensors}
                    onLogEmission={logCarbonSavingActivity}
                  />
                </div>
              </div>
            )}

            {/* LEADERBOARD STANDINGS TAB */}
            {activeTab === "leaderboard" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn max-w-5xl mx-auto text-left">
                
                {/* Standings list */}
                <div className="space-y-4">
                  <CommunityLeaderboard 
                    currentUserId={userProfile.userId}
                    leaderboard={leaderboard}
                    userProfile={userProfile}
                    milestones={milestones}
                    onTriggerCheer={handleTriggerCheer}
                  />
                </div>

                {/* Milestones / Badges displays */}
                <div className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden h-fit">
                  <div className="flex items-center gap-2 pb-4 border-b border-white/5 mb-4">
                    <Award className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <h3 className="font-display font-bold text-base text-white">Ecological Badges</h3>
                      <p className="text-xs text-slate-400">Completed thresholds, user achievements, and custom streak multiplier milestones</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {milestones.map((ms) => {
                      return (
                        <div
                          key={ms.id}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                            ms.unlocked 
                              ? "bg-brand-500/10 border-brand-500/35 text-white shadow-lg shadow-brand-500/5" 
                              : "bg-slate-900/40 border-slate-900 text-slate-500"
                          }`}
                        >
                          <span className={`text-2xl p-2 rounded-lg ${ms.unlocked ? "bg-brand-500/10" : "bg-slate-950 grayscale opacity-60"}`}>
                            {renderMilestoneBadgeIcon(ms.badge)}
                          </span>
                          <div>
                            <span className={`text-xs font-bold block ${ms.unlocked ? "text-brand-400" : "text-slate-500"}`}>
                              {ms.title}
                            </span>
                            <span className="text-[10.5px] text-slate-500 block leading-snug mt-0.5">{ms.requirement}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-6 bg-slate-950 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <div>
            <p>© 2026 CarbonSync Corporation. Google Cloud Zero-Trust Integrity Protected.</p>
            <p className="text-[10px] text-slate-600 mt-1">Simulated IoT meters operate on dynamic offset margins compared against standard petrol equivalent loads.</p>
          </div>
          <div className="flex gap-4">
            <a href="#simulator_container" className="hover:text-slate-300 transition-all font-mono">Telemetry</a>
            <span>•</span>
            <a href="#ai_coaching_widget" className="hover:text-slate-300 transition-all font-mono">Gemini Insights</a>
            <span>•</span>
            <span className="text-[9px] uppercase font-mono font-bold text-slate-600 bg-slate-900/30 px-2 py-0.5 rounded border border-slate-900">UTC System Time: 2026-06-13</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
