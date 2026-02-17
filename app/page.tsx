"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase/client";
import { Header } from "../components/Header";
import { RecentGames } from "../components/RecentGames";
import { type Game, type RatingHistory } from "../lib/glicko";
import { mapGame } from "../lib/types";
import { AuthForm, type AuthFormData } from "../components/AuthForm";
import { PendingGames } from "../components/PendingGames";
import { StreakLeaders } from "../components/StreakLeaders";
import { UserStatsCard } from "../components/UserStatsCard";
import { Skeleton } from "../components/ui/Skeleton";
import { PushManager } from "../components/PushManager";
import { getConfig } from "../lib/config";
import { Button } from "@/components/ui/Button";
import { CACHE_TAGS } from "@/lib/cache-tags";

export default function Home() {
  interface RatingChange {
    gameId: string;
    username: string;
    postRating: number;
    ratingDelta: number;
  }
  interface StreakLeader {
    id: string;
    username: string;
    streak: number;
  }
  interface CurrentUserStats {
    rating: number;
    wins: number;
    losses: number;
    streak: number;
    rd: number;
  }

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [ratingChanges, setRatingChanges] = useState<RatingChange[]>([]);
  const [streakLeaders, setStreakLeaders] = useState<StreakLeader[]>([]);
  const [userStats, setUserStats] = useState<CurrentUserStats | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [requireVerification, setRequireVerification] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchSession = async () => {
    const res = await fetch("/api/auth/session", { method: "GET", cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.user) {
      return { email: null, id: null, username: null };
    }

    return {
      email: data.user.email ?? null,
      id: data.user.id ?? null,
      username: data.profile?.username ?? null,
    };
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setIsCheckingSession(false);
      return;
    }

    let canceled = false;

    const fetchData = async () => {
      if (refreshKey === 0) {
        setLoading(true);
      }

      try {
        const [session, requireVerificationValue] = await Promise.all([
          fetchSession(),
          getConfig("require_verification", true),
        ]);

        if (canceled) return;

        setUserEmail(session.email);
        setUserId(session.id);
        setUserName(session.username);
        setIsCheckingSession(false);
        setRequireVerification(requireVerificationValue);

        const gamesRes = await fetch("/api/games?limit=500", {next: {tags: [CACHE_TAGS.games]}});
        const gamesPayload = await gamesRes.json();
        const gamesData = gamesRes.ok ? gamesPayload.games : null;
        const recentGameIds: string[] = (gamesData ?? []).slice(0, 20).map((g: { id: string }) => g.id);

        let ratingHistoryData: RatingChange[] | null = [];
        if (recentGameIds.length > 0) {
          const ratingHistoryRes = await fetch(
            `/api/rating-history?limit=2000&gameIds=${encodeURIComponent(recentGameIds.join(","))}`,
            {
              next: {tags: [CACHE_TAGS.ratingHistory]}
            },
          );
          const ratingHistoryPayload = await ratingHistoryRes.json();
          ratingHistoryData = ratingHistoryRes.ok ? ratingHistoryPayload.changes : null;
        }

        const streaksRes = await fetch("/api/streaks?min=3&limit=20", {next: {tags: [CACHE_TAGS.streaks]}});
        const streaksPayload = await streaksRes.json();
        const streaksData = streaksRes.ok ? (streaksPayload.leaders as StreakLeader[]) : [];

        let userStatsData: CurrentUserStats | null = null;
        if (session.id) {
          const userStatsRes = await fetch("/api/me/stats", { cache: "no-store"});
          const userStatsPayload = await userStatsRes.json();
          userStatsData = userStatsRes.ok ? (userStatsPayload.stats as CurrentUserStats | null) : null;
        }

        if (canceled) return;

        if (gamesData) setGames(gamesData.map(mapGame));
        if (ratingHistoryData) setRatingChanges(ratingHistoryData);
        setStreakLeaders(streaksData);
        setUserStats(userStatsData);
      } finally {
        if (canceled) return;
        setLoading(false);
        setHasLoadedOnce(true);
      }
    };

    void fetchData();
    return () => {
      canceled = true;
    };
  }, [refreshKey]);

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
        const session = await fetchSession();
        setUserEmail(session.email);
        setUserId(session.id);
        setUserName(session.username);
        setIsCheckingSession(false);
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
        const session = await fetchSession();
        setUserEmail(session.email);
        setUserId(session.id);
        setUserName(session.username);
        setIsCheckingSession(false);
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
    setUserName(null);
    setUserStats(null);
    setAuthLoading(false);
  };

  const verifiedGames = useMemo(() => games.filter(g => g.status === "verified"), [games]);
  const showInitialSkeleton = !hasLoadedOnce && (loading || isCheckingSession);
  const showSessionSkeleton = showInitialSkeleton || isCheckingSession || (userId && !userName);
  const showTopLoading = showInitialSkeleton;

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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-8 sm:px-6">
      <Header />

      {/* Top Section: Streak Leaders & User Stats */}
      <div className="space-y-8">
        <PushManager userId={userId} />
        {/* Active Streaks */}
        {(showInitialSkeleton || userId) && (
          <StreakLeaders leaders={streakLeaders} loading={showTopLoading} />
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {/* User Stats or Sign In */}
            {showSessionSkeleton ? (
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
          {(showInitialSkeleton || userId) && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_60px_rgba(7,10,9,0.6)] backdrop-blur sm:p-6 h-fit">
              <RecentGames games={verifiedGames.slice(0, 20)} loading={showTopLoading} ratingHistory={ratingHistory} />
            </div>
          )}

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
