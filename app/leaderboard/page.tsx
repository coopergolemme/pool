"use client";

import { useEffect, useState } from "react";
import { Leaderboard } from "../../components/Leaderboard";
import { Skeleton } from "../../components/ui/Skeleton";

type LeaderboardRow = {
  player: string;
  rating: number;
  rd: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  streak: number;
};

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      const res = await fetch("/api/leaderboard?limit=200", {
        method: "GET"
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard as LeaderboardRow[]);
      } else {
        setLeaderboard([]);
      }
      setLoading(false);
    };

    void fetchLeaderboard();
  }, []);

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
        <Leaderboard leaderboard={leaderboard} />
      )}
    </div>
  );
}
