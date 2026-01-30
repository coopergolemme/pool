"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase/client";
import { Header } from "../components/Header";
import { SessionStats } from "../components/SessionOverview";
import { RecentGames } from "../components/RecentGames";
import { computeRatingHistory, computeRatings, DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOL, type Game } from "../lib/glicko";
import { mapGame } from "../lib/types";
import { AuthForm } from "../components/AuthForm";

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [userName, setUserName] = useState<string | null>(null);

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
  }, []);

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

  const stats = useMemo(() => {
    return {
      totalGames: games.length, // accurate enough for recent
      uniquePlayers: profiles.length,
    };
  }, [games, profiles]);

  const ratingHistory = useMemo(() => computeRatingHistory(games), [games]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-8 sm:px-6">
      <Header
        userEmail={userEmail}
        userName={userName}
        onSignOut={handleSignOut}
        authLoading={authLoading}
      />

      <div className="grid  lg:grid-cols-[1fr_1fr]">
         <div className="space-y-6">
            {!userEmail && (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6">
                    <h2 className="mb-4 text-xl font-bold">Sign In</h2>
                    <AuthForm
                    onSignIn={handleSignIn}
                    onSignUp={handleSignUp}
                    loading={authLoading}
                    />
                </div>
            )}
            {/* <SessionStats
                totalGames={stats.totalGames}
                uniquePlayers={stats.uniquePlayers}
            /> */}
         </div>
        
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_60px_rgba(7,10,9,0.6)] backdrop-blur sm:p-6">
          <RecentGames games={games} loading={loading} ratingHistory={ratingHistory} />
        </div>
      </div>
    </main>
  );
}
