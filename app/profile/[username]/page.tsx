"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { RecentGames } from "../../../components/RecentGames";
import { RatingChart } from "../../../components/RatingChart";
import { computeRatings, computeRatingHistory, DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOL, type Game } from "../../../lib/glicko";
import { mapGame } from "../../../lib/types";
import { Skeleton } from "../../../components/ui/Skeleton";

export default function ProfilePage() {
  const params = useParams();
  const rawUsername = params.username as string;
  const username = decodeURIComponent(rawUsername);

  const [currentUserProfile, setCurrentUserProfile] = useState<{ username: string } | null>(null);

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; username: string; email: string; rating: number; rd: number; vol: number; streak: number } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getSession().then(async ({ data }) => {
        if (data.session?.user?.id) {
            if (!supabase) return;
            const { data: userData } = await supabase.from("profiles").select("username").eq("id", data.session.user.id).single();
            if (userData) setCurrentUserProfile(userData);
        }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user?.id) {
             if (!supabase) return;
             const { data: userData } = await supabase.from("profiles").select("username").eq("id", session.user.id).single();
             if (userData) setCurrentUserProfile(userData);
        } else {
            setCurrentUserProfile(null);
        }
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !username) return;

    const fetchData = async () => {
      setLoading(true);
      
      if (!supabase) return;

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, email, rating, rd, vol, streak")
        .eq("username", username)
        .single();
      
      if (profileData) {
          setProfile(profileData);
      }

      // Fetch all games to compute accurate stats/history
      // optimizing this might differ in production (e.g. server-side aggregation)
      // but for Glicko we generally need history. 
      // We could filter fetching, but computeRatings needs context of opponents too ideally.
      // For now, let's fetch all games and filter in memory for display, to ensure computeRatings has full context.
      if (!supabase) return;
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (gamesData) setGames(gamesData.map(mapGame));

      setLoading(false);
    };

    fetchData();
  }, [username]);

  const stats = useMemo(() => {
    const gameStats = computeRatings(games);
    const record = gameStats.get(username) ?? {
        rating: DEFAULT_RATING,
        rd: DEFAULT_RD,
        vol: DEFAULT_VOL,
        wins: 0,
        losses: 0,
        streak: profile?.streak ?? 0,
    };
    
    // If we have a DB profile, we might use that for current rating, but Glicko is re-computed here
    // let's stick to consistent computed Glicko
    const gamesPlayed = record.wins + record.losses;
    const winRate = gamesPlayed ? Math.round((record.wins / gamesPlayed) * 100) : 0;
    
    // Calculate Avg Balls Won
    const wonGamesWithBallsRecord = games.filter(
        g => g.winner === username && g.status === "verified" && g.ballsRemaining !== null && g.ballsRemaining !== undefined
    );
    const totalBallsWon = wonGamesWithBallsRecord.reduce((sum, g) => sum + (g.ballsRemaining || 0), 0);
    const avgBallsWon = wonGamesWithBallsRecord.length > 0 
        ? (totalBallsWon / wonGamesWithBallsRecord.length).toFixed(1) 
        : "-";

    return {
        ...record,
        gamesPlayed,
        winRate,
        avgBallsWon,
        rating: Math.round(record.rating),
        rd: Math.round(record.rd),
    };
  }, [games, username, profile]);

  const [activeFilter, setActiveFilter] = useState<"all" | "h2h">("all");

  const playerGames = useMemo(() => {
      const verifiedGames = games.filter(g => g.status === "verified");
      const allPlayerGames = verifiedGames.filter(g => g.players.includes(username));
      
      if (activeFilter === "h2h" && currentUserProfile && currentUserProfile.username !== username) {
          return allPlayerGames.filter(g => g.players.includes(currentUserProfile.username));
      }
      return allPlayerGames;
  }, [games, username, activeFilter, currentUserProfile]);

  const vsRecord = useMemo(() => {
      if (!currentUserProfile || !username || currentUserProfile.username === username) return null;
      
      const vsGames = games.filter(g => g.players.includes(currentUserProfile.username) && g.players.includes(username));
      let wins = 0;
      let losses = 0;
      vsGames.forEach(g => {
          if (g.winner === currentUserProfile.username) wins++;
          else if (g.winner === username) losses++;
      });
      
      return wins > 0 || losses > 0 ? `${wins}-${losses}` : null;
  }, [games, username, currentUserProfile]);

  const ratingHistory = useMemo(() => computeRatingHistory(games), [games]);

  // Compute chart data from games and rating history
  const chartData = useMemo(() => {
    if (!games.length || !ratingHistory) return [];

    // Clone and sort games chronologically (Oldest -> Newest)
    const sortedGames = [...games].sort((a, b) => {
        if (a.date === b.date) {
            return a.createdAt < b.createdAt ? -1 : 1;
        }
        return a.date < b.date ? -1 : 1;
    });

    const data = [];
    let gameIndex = 0;
    
    // We want to track the *current user's* rating as we walk through history
    // giving us a point-in-time comparison.
    // If not signed in, this stays null/undefined.
    let currentCtxUserRating: number | undefined = undefined;

    // We also need the *profile user's* rating to plot.
    // We only plot points where the profile user effectively played.
    
    for (const game of sortedGames) {
        // Update current user's rating state if they played in this game
        if (currentUserProfile && game.players.includes(currentUserProfile.username)) {
            const h = ratingHistory[game.id]?.[currentUserProfile.username];
            if (h) {
                currentCtxUserRating = h.rating;
            }
        }

        // Only include games where the *profile* player played for the main line
        if (!game.players.includes(username)) continue;

        const history = ratingHistory[game.id];
        if (history && history[username]) {
            const opponent = game.players.find(p => p !== username);
            const isWinner = game.winner === username;
            
            data.push({
                date: game.date,
                rating: history[username].rating,
                gameIndex: gameIndex++,
                opponent,
                result: isWinner ? "W" : "L" as "W" | "L", // Explicit cast for TS
                userRating: (currentUserProfile?.username === username) ? undefined : currentCtxUserRating, // Snapshot of your rating at that time
            });
        }
    }
    return data;
  }, [games, ratingHistory, username, currentUserProfile]);

  if (loading) {
      return (
        <div className="mx-auto max-w-4xl p-4 sm:p-6 pb-24">
            <div className="mb-8">
                <Skeleton className="h-12 w-64 mb-6" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Skeleton className="h-24 rounded-2xl col-span-2" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-16 rounded-2xl col-span-2 sm:col-span-full" />
                </div>
            </div>
            <div className="mb-8">
                <Skeleton className="h-64 w-full rounded-3xl" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-40 w-full rounded-3xl" />
            </div>
        </div>
      );
  }

  if (!profile && !loading && playerGames.length === 0) {
       // Fallback if profile doesn't exist in DB but might be in legacy games (unlikely if profiles table is source of truth)
       // or just invalid URL
      return <div className="p-8 text-center text-white/50">Player not found</div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 pb-24">
      <div className="mb-8">
        <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-widest text-white sm:text-6xl">
          {username}
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
             <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center col-span-2">
                 <p className="text-xs uppercase tracking-widest text-white/50">Rating</p>
                 <p className="text-2xl font-bold text-white">{stats.rating}</p>
                 <p className="text-[10px] text-white/40">±{stats.rd}</p>
             </div>
             <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                 <p className="text-xs uppercase tracking-widest text-white/50">Win Rate</p>
                 <p className="text-2xl font-bold text-white">{stats.winRate}%</p>
                 <p className="text-[10px] text-white/40">{stats.wins}W - {stats.losses}L</p>
             </div>
             <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                 <p className="text-xs uppercase tracking-widest text-white/50">Streak</p>
                 <div className="flex items-center justify-center gap-1">
                     <span className="text-2xl font-bold text-white">{Math.abs(stats.streak)}</span>
                     {Math.abs(stats.streak) >= 3 && (
                         <span className="text-xl">{stats.streak > 0 ? "🔥" : "❄️"}</span>
                     )}
                 </div>
                 <p className="text-[10px] text-white/40">{stats.streak > 0 ? "Wins" : "Losses"}</p>
             </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-white/50">Avg Won By</p>
                  <p className="text-2xl font-bold text-white">{stats.avgBallsWon}</p>
                  <p className="text-[10px] text-white/40">balls remaining</p>
              </div>
               <div 
                  onClick={() => setActiveFilter("all")}
                  className={`rounded-2xl border bg-white/5 p-4 text-center transition-colors cursor-pointer ${
                    activeFilter === "all" ? "border-purple-500/50 bg-white/10" : "border-white/10 hover:bg-white/10"
                 } ${!vsRecord ? "col-span-2 sm:col-span-full" : ""}`}
              >
                 <p className="text-xs uppercase tracking-widest text-white/50">Games</p>
                 <p className="text-2xl font-bold text-white">{stats.gamesPlayed}</p>
             </div>
             {vsRecord && (
                 <div 
                     onClick={() => setActiveFilter("h2h")}
                     className={`rounded-2xl border bg-white/5 p-4 text-center transition-colors cursor-pointer ${activeFilter === "h2h" ? "border-purple-500/50 bg-white/10" : "border-white/10 hover:bg-white/10"}`}
                 >
                     <p className="text-xs uppercase tracking-widest text-white/50">Vs You</p>
                     <p className="text-2xl font-bold text-white">{vsRecord}</p>
                 </div>
             )}
        </div>
      </div>

      <div className="mb-8">
        <RatingChart data={chartData} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_60px_rgba(7,10,9,0.6)] backdrop-blur sm:p-6">
        <RecentGames title={activeFilter === "all" ? "Recent Games" : "Head-to-Head"} games={playerGames} loading={loading} ratingHistory={ratingHistory} />
      </div>
    </div>
  );
}
