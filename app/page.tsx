"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase/client";
import { Header } from "../components/Header";
import { RecentGames } from "../components/RecentGames";
import { computeRatingHistory, computeRatings, DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOL, type Game } from "../lib/glicko";
import { mapGame } from "../lib/types";
import { AuthForm } from "../components/AuthForm";
import { PendingGames } from "../components/PendingGames";
import { StreakLeaders } from "../components/StreakLeaders";
import { UserStatsCard } from "../components/UserStatsCard";
import { Skeleton } from "../components/ui/Skeleton";

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      
      if (!supabase) return;

      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);

      if (!supabase) return;

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");

      if (gamesData) setGames(gamesData.map(mapGame));
      if (profilesData) setProfiles(profilesData);
      
      setLoading(false);
    };

    fetchData();

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
      setIsCheckingSession(false);
    });

      if (!supabase) return;
      
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      if (session?.user?.id && session.user.email) {
          if (supabase) {
           void supabase
           .from("profiles")
           .upsert({ id: session.user.id, email: session.user.email }, { onConflict: "id" });
          }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshKey]);

  useEffect(() => {
    if (userId && profiles.length > 0) {
      const profile = profiles.find((p) => p.id === userId);
      if (profile) {
        setUserName(profile.username);
      }
    } else {
        setUserName(null);
    }
  }, [userId, profiles]);

  const handleSignIn = async (authForm: any) => {
    if (!supabase) return;
    setAuthLoading(true);
    await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    });
    setAuthLoading(false);
  };

  const handleSignUp = async (authForm: any) => {
    if (!supabase) return;
    setAuthLoading(true);
    await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
    });
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    await supabase.auth.signOut();
    setAuthLoading(false);
  };

  const verifiedGames = useMemo(() => games.filter(g => g.status === "verified"), [games]);
  const ratingHistory = useMemo(() => computeRatingHistory(verifiedGames), [verifiedGames]);

  // Compute Glicko stats for all players to find streak leaders
  const playerStats = useMemo(() => computeRatings(verifiedGames), [verifiedGames]);

  // Find current user's stats
  const userStats = useMemo(() => {
      if (!userName || !playerStats) return null;
      return playerStats.get(userName) ?? null;
  }, [userName, playerStats]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 sm:px-6">
      <Header
        userEmail={userEmail}
        userName={userName}
        onSignOut={handleSignOut}
        authLoading={authLoading}
      />

      {/* Top Section: Streak Leaders & User Stats */}
      <div className="space-y-8">
          {/* Active Streaks */}
          <StreakLeaders stats={playerStats} loading={loading} />
          
          <div className="grid lg:grid-cols-2 gap-8">
             <div className="space-y-6">
                 {/* User Stats or Sign In */}
                 {/* User Stats or Sign In */}
                 {isCheckingSession || (userId && !userName) ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6 min-h-[200px]">
                        <Skeleton className="h-8 w-1/2 mb-4" />
                        <Skeleton className="h-10 w-full mb-2" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                 ) : userEmail && userName ? (
                     <UserStatsCard stats={userStats} username={userName} />
                 ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6">
                        <h2 className="mb-4 text-xl font-bold">Sign In to Track Stats</h2>
                        <AuthForm
                        onSignIn={handleSignIn}
                        onSignUp={handleSignUp}
                        loading={authLoading}
                        />
                    </div>
                 )}

                 {/* Pending Games Alert */}
                 <PendingGames userId={userId} userName={userName} onUpdate={() => setRefreshKey(k => k + 1)} />
             </div>

             {/* Recent Games Feed */}
             <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_60px_rgba(7,10,9,0.6)] backdrop-blur sm:p-6 h-fit">
                <RecentGames games={verifiedGames} loading={loading} ratingHistory={ratingHistory} />
             </div>
          </div>
      </div>
    </main>
  );
}
