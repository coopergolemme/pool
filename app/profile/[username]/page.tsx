"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { RecentGames } from "../../../components/RecentGames";
import { computeRatings, computeRatingHistory, DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOL, type Game } from "../../../lib/glicko";
import { mapGame } from "../../../lib/types";

export default function ProfilePage() {
  const params = useParams();
  const rawUsername = params.username as string;
  const username = decodeURIComponent(rawUsername);

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string; username: string; email: string; rating: number; rd: number; vol: number; streak: number } | null>(null);

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
        .order("date", { ascending: false });

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
    
    return {
        ...record,
        gamesPlayed,
        winRate,
        rating: Math.round(record.rating),
        rd: Math.round(record.rd),
    };
  }, [games, username, profile]);

  const playerGames = useMemo(() => {
      return games.filter(g => g.players.includes(username));
  }, [games, username]);

  const ratingHistory = useMemo(() => computeRatingHistory(games), [games]);

  if (loading) {
      return <div className="p-8 text-center text-white/50">Loading profile...</div>;
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
             <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
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
                 <p className="text-xs uppercase tracking-widest text-white/50">Games</p>
                 <p className="text-2xl font-bold text-white">{stats.gamesPlayed}</p>
             </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_60px_rgba(7,10,9,0.6)] backdrop-blur sm:p-6">
        <RecentGames games={playerGames} loading={loading} ratingHistory={ratingHistory} />
      </div>
    </div>
  );
}
