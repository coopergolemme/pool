"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { parseTeam, type Game, type RatingHistory } from "../../../lib/glicko";
import { RecentGames } from "../../../components/RecentGames";
import { RatingChart } from "../../../components/RatingChart";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";

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
  rating9Ball: number;
  rd9Ball: number;
  vol9Ball: number;
  streak9Ball: number;
  wins9Ball: number;
  losses9Ball: number;
};

type ChartPoint = {
  date: string;
  rating: number;
  gameNumber: number;
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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editNotificationsEnabled, setEditNotificationsEnabled] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [profileEditSuccess, setProfileEditSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [authRes, profileRes] = await Promise.all([
        fetch("/api/auth/session", { method: "GET", cache: "no-store" }),
        fetch(`/api/profile/${encodeURIComponent(username)}`, { method: "GET" }),
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

  useEffect(() => {
    if (!isEditingProfile || currentUsername !== username) return;

    const fetchEditableProfile = async () => {
      const res = await fetch("/api/me/profile", { method: "GET", cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.profile) return;
      setEditUsername(data.profile.username ?? "");
      setEditNotificationsEnabled(Boolean(data.profile.notificationsEnabled));
    };

    void fetchEditableProfile();
  }, [isEditingProfile, currentUsername, username]);

  const stats = useMemo(() => {
    if (!profile) return null;
    const gamesPlayed = profile.wins + profile.losses;
    const winRate = gamesPlayed ? Math.round((profile.wins / gamesPlayed) * 100) : 0;
    const gamesPlayed9Ball = profile.wins9Ball + profile.losses9Ball;
    const winRate9Ball = gamesPlayed9Ball ? Math.round((profile.wins9Ball / gamesPlayed9Ball) * 100) : 0;
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
      rating9Ball: Math.round(profile.rating9Ball),
      rd9Ball: Math.round(profile.rd9Ball),
      wins9Ball: profile.wins9Ball,
      losses9Ball: profile.losses9Ball,
      streak9Ball: profile.streak9Ball,
      gamesPlayed9Ball,
      winRate9Ball,
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
    let gameNumber = 1;
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
          gameNumber: gameNumber++,
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

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileEditError(null);
    setProfileEditSuccess(null);

    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editUsername,
          notificationsEnabled: editNotificationsEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileEditError(data.error ?? "Failed to update profile.");
        return;
      }

      const nextUsername = data.profile?.username ?? editUsername;
      setProfileEditSuccess("Profile updated.");
      setIsEditingProfile(false);
      if (nextUsername && nextUsername !== username) {
        window.location.assign(`/profile/${encodeURIComponent(nextUsername)}`);
        return;
      }

      setCurrentUsername(nextUsername ?? null);
      setProfile((prev) => (prev ? { ...prev, username: nextUsername } : prev));
    } catch {
      setProfileEditError("Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 pb-24">
      <div className="mb-8">
        <div className="flex items-end justify-between">
          <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-widest text-white sm:text-6xl">
            {username}
          </h1>
          {currentUsername === username && (
            <button
              onClick={() => {
                setProfileEditError(null);
                setProfileEditSuccess(null);
                setIsEditingProfile((prev) => !prev);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#caa468]/60 bg-[#caa468] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ddb87a]"
            >
              Edit Profile
            </button>
          )}
        </div>
        {isEditingProfile && currentUsername === username && (
          <form
            onSubmit={saveProfile}
            className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4"
          >
            {profileEditError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {profileEditError}
              </div>
            )}
            {profileEditSuccess && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
                {profileEditSuccess}
              </div>
            )}
            <Input
              label="Username"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              minLength={3}
              maxLength={24}
              required
            />
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
              Push Notifications
              <input
                type="checkbox"
                checked={editNotificationsEnabled}
                onChange={(e) => setEditNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/50"
              />
            </label>
            <p className="text-xs text-white/50">
              Turning this off removes your current subscription. Turning it on requires browser
              permission from the home page prompt.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditingProfile(false)}
                disabled={savingProfile}
              >
                Cancel
              </Button>
              <Link
                href="/forgot-password"
                className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:border-white/30 hover:text-white"
              >
                Reset Password
              </Link>
            </div>
          </form>
        )}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center col-span-2">
            <p className="text-xs uppercase tracking-widest text-white/50">8-Ball Rating</p>
            <p className="text-2xl font-bold text-white">{stats.rating}</p>
            <p className="text-[10px] text-white/40">±{stats.rd}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center col-span-2">
            <p className="text-xs uppercase tracking-widest text-white/50">9-Ball Rating</p>
            <p className="text-2xl font-bold text-white">{stats.rating9Ball}</p>
            <p className="text-[10px] text-white/40">±{stats.rd9Ball}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-white/50">8-Ball Win Rate</p>
            <p className="text-2xl font-bold text-white">{stats.winRate}%</p>
            <p className="text-[10px] text-white/40">
              {stats.wins}W - {stats.losses}L
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-white/50">8-Ball Streak</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-white">{Math.abs(stats.streak)}</span>
              {Math.abs(stats.streak) >= 3 && (
                <span className="text-xl">{stats.streak > 0 ? "🔥" : "❄️"}</span>
              )}
            </div>
            <p className="text-[10px] text-white/40">{stats.streak > 0 ? "Wins" : "Losses"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-white/50">9-Ball Win Rate</p>
            <p className="text-2xl font-bold text-white">{stats.winRate9Ball}%</p>
            <p className="text-[10px] text-white/40">
              {stats.wins9Ball}W - {stats.losses9Ball}L
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-white/50">9-Ball Streak</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-white">{Math.abs(stats.streak9Ball)}</span>
              {Math.abs(stats.streak9Ball) >= 3 && (
                <span className="text-xl">{stats.streak9Ball > 0 ? "🔥" : "❄️"}</span>
              )}
            </div>
            <p className="text-[10px] text-white/40">{stats.streak9Ball > 0 ? "Wins" : "Losses"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-white/50">Avg Won By</p>
            <p className="text-2xl font-bold text-white">{stats.avgBallsWon}</p>
            <p className="text-[10px] text-white/40">balls remaining</p>
          </div>
          <div
            onClick={() => setActiveFilter("all")}
            className={`rounded-2xl border bg-white/5 p-4 text-center transition-colors cursor-pointer ${activeFilter === "all" ? "border-[#caa468]/50 bg-white/10" : "border-white/10 hover:bg-white/10"} ${!vsRecord ? "col-span-2 sm:col-span-full" : ""}`}
          >
            <p className="text-xs uppercase tracking-widest text-white/50">Games</p>
            <p className="text-2xl font-bold text-white">{stats.gamesPlayed}</p>
          </div>
          {vsRecord && (
            <div
              onClick={() => setActiveFilter("h2h")}
              className={`rounded-2xl border bg-white/5 p-4 text-center transition-colors cursor-pointer ${activeFilter === "h2h" ? "border-[#caa468]/50 bg-white/10" : "border-white/10 hover:bg-white/10"}`}
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
