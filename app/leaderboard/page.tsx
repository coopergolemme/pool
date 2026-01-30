"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase/client";
import { Leaderboard } from "../../components/Leaderboard";
import { computeRatings, DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOL, type Game } from "../../lib/glicko";
import { mapGame } from "../../lib/types";
import { Skeleton } from "../../components/ui/Skeleton";

export default function LeaderboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [profiles, setProfiles] = useState<
    { id: string; username: string; email: string; rating: number; rd: number; vol: number; streak: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    const fetchData = async () => {
      setLoading(true);

      if (!supabase) return;
      
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .order("date", { ascending: false });
      
      if (!supabase) return;

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, email, rating, rd, vol, streak");

      if (gamesData) setGames(gamesData.map(mapGame));
      
      if (profilesData) {
        setProfiles(
          profilesData
            .filter((p) => p.username)
            .map((p) => ({
              id: p.id,
              username: p.username,
              email: p.email,
              rating: p.rating ?? DEFAULT_RATING,
              rd: p.rd ?? DEFAULT_RD,
              vol: p.vol ?? DEFAULT_VOL,
              streak: p.streak ?? 0,
            }))
        );
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  const stats = useMemo(() => {
    const gameStats = computeRatings(games);
    
    const leaderboard = profiles.map((profile) => {
      const record = gameStats.get(profile.username) ?? {
        rating: profile.rating ?? DEFAULT_RATING,
        rd: profile.rd ?? DEFAULT_RD,
        vol: profile.vol ?? DEFAULT_VOL,
        wins: 0,
        losses: 0,
        streak: profile.streak ?? 0,
      };
      
      const gamesPlayed = record.wins + record.losses;
      const winRate = gamesPlayed ? Math.round((record.wins / gamesPlayed) * 100) : 0;

      return {
        player: profile.username,
        rating: Math.round(record.rating),
        rd: Math.round(record.rd),
        wins: record.wins,
        losses: record.losses,
        streak: record.streak,
        gamesPlayed,
        winRate,
      };
    });

    leaderboard.sort((a, b) => b.rating - a.rating || b.winRate - a.winRate);
    
    return leaderboard.filter(p => p.gamesPlayed > 0);
  }, [games, profiles]);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
       <div className="mb-8 text-center">
        <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-widest text-white sm:text-6xl">
          Leaderboard
        </h1>
        <p className="mt-2 text-white/50">Global Rankings & Stats</p>
      </div>
      
      {loading ? (
        <div className="space-y-4">
           {[...Array(8)].map((_, i) => (
             <Skeleton key={i} className="h-16 w-full rounded-2xl" />
           ))}
        </div>
      ) : (
        <Leaderboard leaderboard={stats} />
      )}
    </div>
  );
}
