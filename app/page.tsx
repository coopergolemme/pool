"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase/client";
import { Header } from "../components/Header";
import { RecentGames } from "../components/RecentGames";
import { computeRatings, type Game, type RatingHistory } from "../lib/glicko";
import { mapGame } from "../lib/types";
import { AuthForm, type AuthFormData } from "../components/AuthForm";
import { PendingGames } from "../components/PendingGames";
import { StreakLeaders } from "../components/StreakLeaders";
import { UserStatsCard } from "../components/UserStatsCard";
import { Skeleton } from "../components/ui/Skeleton";
import { PushManager } from "../components/PushManager";
import { getConfig } from "../lib/config";
import { Button } from "@/components/ui/Button";

export default function Home() {
  interface Profile {
    id: string;
    username: string | null;
  }
  interface RatingChange {
    gameId: string;
    username: string;
    postRating: number;
    ratingDelta: number;
  }

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ratingChanges, setRatingChanges] = useState<RatingChange[]>([]);

  const [refreshKey, setRefreshKey] = useState(0);
  const [requireVerification, setRequireVerification] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    const res = await fetch("/api/auth/session", { method: "GET", cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.user) {
      setUserEmail(null);
      setUserId(null);
      setIsCheckingSession(false);
      return;
    }

    setUserEmail(data.user.email ?? null);
    setUserId(data.user.id ?? null);
    setIsCheckingSession(false);
  };

  useEffect(() => {
    if (!supabase) return;

    getConfig("require_verification", true).then(setRequireVerification);

    const fetchData = async () => {

      if (!supabase) return;
      setLoading(true);

      const gamesRes = await fetch("/api/games?limit=500", {
        method: "GET",
        cache: "no-store",
      });
      const gamesPayload = await gamesRes.json();
      const gamesData = gamesRes.ok ? gamesPayload.games : null;
      const recentGameIds: string[] = (gamesData ?? []).slice(0, 20).map((g: { id: string }) => g.id);

      let ratingHistoryData: RatingChange[] | null = [];
      if (recentGameIds.length > 0) {
        const ratingHistoryRes = await fetch(
          `/api/rating-history?limit=2000&gameIds=${encodeURIComponent(recentGameIds.join(","))}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );
        const ratingHistoryPayload = await ratingHistoryRes.json();
        ratingHistoryData = ratingHistoryRes.ok ? ratingHistoryPayload.changes : null;
      }

      if (!supabase) return;

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");

      if (gamesData) setGames(gamesData.map(mapGame));
      if (ratingHistoryData) setRatingChanges(ratingHistoryData);
      if (profilesData) setProfiles(profilesData);

      setLoading(false);
    };

    fetchData();
    setTimeout(() => {
      void fetchSession();
    }, 0);
  }, [refreshKey]);

  const userName = useMemo(() => {
    if (userId && profiles.length > 0) {
      const profile = profiles.find((p) => p.id === userId);
      return profile ? profile.username : null;
    }
    return null;
  }, [userId, profiles]);

  const handleSignIn = async (authForm: AuthFormData) => {
    setAuthLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
      } else {
        await fetchSession();
        setRefreshKey((k) => k + 1);
      }
    } catch {
      setError("Sign in failed");
    }
    setAuthLoading(false);
  };

  const handleSignUp = async (authForm: AuthFormData) => {
    setAuthLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password || "",
          username: authForm.username,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign up failed");
      } else if (data.needsEmailConfirmation) {
        setError("Check your email to confirm your account before signing in.");
      } else {
        await fetchSession();
        setRefreshKey((k) => k + 1);
      }
    } catch {
      setError("Sign up failed");
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    await fetch("/api/sign-out", { method: "POST" });
    setUserEmail(null);
    setUserId(null);
    setAuthLoading(false);
  };

  const verifiedGames = useMemo(() => games.filter(g => g.status === "verified"), [games]);

  const ratingHistory = useMemo<RatingHistory>(() => {
    return ratingChanges.reduce<RatingHistory>((acc, change) => {
      if (!acc[change.gameId]) {
        acc[change.gameId] = {};
      }
      acc[change.gameId][change.username] = {
        rating: change.postRating,
        delta: change.ratingDelta,
      };
      return acc;
    }, {});
  }, [ratingChanges]);

  console.log("Rating History:", ratingHistory);

  // Compute Glicko stats for all players to find streak leaders
  const playerStats = useMemo(() => computeRatings(verifiedGames), [verifiedGames]);

  // Find current user's stats
  const userStats = useMemo(() => {
    if (!userName || !playerStats) return null;
    return playerStats.get(userName) ?? null;
  }, [userName, playerStats]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 sm:px-6">
      <Header />

      {/* Top Section: Streak Leaders & User Stats */}
      <div className="space-y-8">
        <PushManager userId={userId} />
        {/* Active Streaks */}
        {userId && (
          <StreakLeaders stats={playerStats} loading={loading} />
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
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
              <AuthForm
                onSignIn={handleSignIn}
                onSignUp={handleSignUp}
                loading={authLoading}
                error={error}
              />
            )}

            {/* Pending Games Alert */}
            <PendingGames
              userId={userId}
              userName={userName}
              onUpdate={() => setRefreshKey(k => k + 1)}
              enabled={requireVerification}
            />
          </div>

          {/* Recent Games Feed */}
          {
            userId &&

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_60px_rgba(7,10,9,0.6)] backdrop-blur sm:p-6 h-fit">
              <RecentGames games={verifiedGames.slice(0, 20)} loading={loading} ratingHistory={ratingHistory} />
            </div>
          }

          {/* Signout button */}
          {userEmail && userName && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              disabled={authLoading}
            >
              Sign Out
            </Button>
          )}
        </div>

      </div>
    </main>
  );
}
