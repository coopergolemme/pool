"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { parseTeam, type Game, type RatingHistory } from "../../../lib/glicko";
import { RecentGames } from "../../../components/RecentGames";
import { RatingChart } from "../../../components/RatingChart";
import { Skeleton } from "../../../components/ui/Skeleton";

type ProfileStats = {
  id: string;
  username: string;
  email: string;
  rating: number;
  rd: number;
  vol: number;
  streak: number;
  wins: number;
  losses: number;
};

type ChartPoint = {
  date: string;
  rating: number;
  gameIndex: number;
  userRating?: number;
  opponent?: string;
  result?: "W" | "L";
};

const gameHasPlayer = (game: Game, name: string) => {
  const is2v2 = game.format === "8-ball-2v2";
  return game.players.some((team) => parseTeam(team, is2v2).includes(name));
};

const didPlayerWin = (game: Game, name: string) => {
  const is2v2 = game.format === "8-ball-2v2";
  return parseTeam(game.winner, is2v2).includes(name);
};

const getOpponentLabel = (game: Game, name: string) => {
  const is2v2 = game.format === "8-ball-2v2";
  const teamWithPlayer = game.players.find((team) => parseTeam(team, is2v2).includes(name));
  return game.players.find((team) => team !== teamWithPlayer);
};

export default function ProfilePage() {
  const params = useParams();
  const rawUsername = params.username as string;
  const username = decodeURIComponent(rawUsername);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [ratingHistory, setRatingHistory] = useState<RatingHistory>({});
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "h2h">("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [authRes, profileRes] = await Promise.all([
        fetch("/api/auth/session", { method: "GET", cache: "no-store" }),
        fetch(`/api/profile/${encodeURIComponent(username)}`, { method: "GET", cache: "no-store" }),
      ]);

      const authData = await authRes.json();
      const profileData = await profileRes.json();

      setCurrentUsername(authRes.ok ? (authData.profile?.username ?? null) : null);

      if (!profileRes.ok) {
        setProfile(null);
        setGames([]);
        setRatingHistory({});
        setLoading(false);
        return;
      }

      setProfile(profileData.profile ?? null);
      setGames((profileData.games ?? []) as Game[]);
      setRatingHistory((profileData.ratingHistory ?? {}) as RatingHistory);
      setLoading(false);
    };

    void fetchData();
  }, [username]);

  const stats = useMemo(() => {
    if (!profile) return null;
    const gamesPlayed = profile.wins + profile.losses;
    const winRate = gamesPlayed ? Math.round((profile.wins / gamesPlayed) * 100) : 0;
    const avgBallsWon = (() => {
      const winsWithBalls = games.filter(
        (g) => didPlayerWin(g, username) && g.ballsRemaining !== null && g.ballsRemaining !== undefined,
      );
      if (winsWithBalls.length === 0) return "-";
      const total = winsWithBalls.reduce((sum, g) => sum + (g.ballsRemaining || 0), 0);
      return (total / winsWithBalls.length).toFixed(1);
    })();

    return {
      rating: Math.round(profile.rating),
      rd: Math.round(profile.rd),
      wins: profile.wins,
      losses: profile.losses,
      streak: profile.streak,
      gamesPlayed,
      winRate,
      avgBallsWon,
    };
  }, [profile, games, username]);

  const playerGames = useMemo(() => {
    const relevant = games.filter((g) => gameHasPlayer(g, username));
    if (activeFilter === "h2h" && currentUsername && currentUsername !== username) {
      return relevant.filter((g) => gameHasPlayer(g, currentUsername));
    }
    return relevant;
  }, [games, username, activeFilter, currentUsername]);

  const vsRecord = useMemo(() => {
    if (!currentUsername || currentUsername === username) return null;
    const vsGames = games.filter((g) => gameHasPlayer(g, currentUsername) && gameHasPlayer(g, username));
    let wins = 0;
    let losses = 0;
    vsGames.forEach((g) => {
      if (didPlayerWin(g, currentUsername)) wins += 1;
      else if (didPlayerWin(g, username)) losses += 1;
    });
    return wins > 0 || losses > 0 ? `${wins}-${losses}` : null;
  }, [games, username, currentUsername]);

  const chartData = useMemo(() => {
    if (!games.length) return [];

    const sortedGames = [...games].sort((a, b) => {
      if (a.date === b.date) return a.createdAt < b.createdAt ? -1 : 1;
      return a.date < b.date ? -1 : 1;
    });

    const data: ChartPoint[] = [];
    let gameIndex = 0;
    let currentCtxUserRating: number | undefined;
    let currentProfileRating: number | undefined;
    let hasProfileStarted = false;

    for (const game of sortedGames) {
      const history = ratingHistory[game.id];
      if (!history) continue;

      const profilePlayed = gameHasPlayer(game, username);
      const userPlayed = currentUsername ? gameHasPlayer(game, currentUsername) : false;

      if (profilePlayed) {
        const h = history[username];
        if (h) {
          currentProfileRating = h.rating;
          hasProfileStarted = true;
        }
      }

      if (userPlayed && currentUsername) {
        const h = history[currentUsername];
        if (h) currentCtxUserRating = h.rating;
      }

      if (hasProfileStarted && (profilePlayed || userPlayed)) {
        const result: "W" | "L" | undefined = profilePlayed
          ? (didPlayerWin(game, username) ? "W" : "L")
          : undefined;
        data.push({
          date: game.date,
          rating: currentProfileRating!,
          gameIndex: gameIndex++,
          opponent: profilePlayed ? getOpponentLabel(game, username) : undefined,
          result,
          userRating: currentUsername === username ? undefined : currentCtxUserRating,
        });
      }
    }

    return data;
  }, [games, ratingHistory, username, currentUsername]);

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

  if (!profile || !stats) {
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
            <p className="text-[10px] text-white/40">
              {stats.wins}W - {stats.losses}L
            </p>
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
            className={`rounded-2xl border bg-white/5 p-4 text-center transition-colors cursor-pointer ${activeFilter === "all" ? "border-purple-500/50 bg-white/10" : "border-white/10 hover:bg-white/10"} ${!vsRecord ? "col-span-2 sm:col-span-full" : ""}`}
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
        <RecentGames
          title={activeFilter === "all" ? "Recent Games" : "Head-to-Head"}
          games={playerGames}
          loading={loading}
          ratingHistory={ratingHistory}
        />
      </div>
    </div>
  );
}
