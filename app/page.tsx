"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase/client";

type Game = {
  id: string;
  date: string;
  table: string;
  format: "8-ball" | "8-ball-2v2";
  players: [string, string];
  winner: string;
  score: string;
  createdAt: string;
};

type DbGame = {
  id: string;
  date: string | null;
  table_name: string | null;
  format: string | null;
  race_to: number | null;
  player_a: string | null;
  player_b: string | null;
  winner: string | null;
  score: string | null;
  opponent_id: string | null;
  opponent_email: string | null;
  created_at: string | null;
};

const formatLabels: Record<Game["format"], string> = {
  "8-ball": "8-Ball",
  "8-ball-2v2": "2v2 8-Ball",
};

const mapGame = (row: DbGame): Game => {
  const format = (row.format ?? "8-ball") as Game["format"];
  return {
    id: row.id,
    date: row.date ?? "",
    table: row.table_name ?? "Table 1",
    format,
    players: [row.player_a ?? "", row.player_b ?? ""],
    winner: row.winner ?? "",
    score: row.score ?? "",
    createdAt: row.created_at ?? "",
  };
};

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [profiles, setProfiles] = useState<{ id: string; username: string; email: string }[]>([]);
  const [form, setForm] = useState({
    date: "",
    table: "Table 1",
    format: "8-ball" as Game["format"],
    playerA: "",
    playerB: "",
    playerC: "",
    playerD: "",
    winner: "",
    score: "",
  });

  const loadGames = async () => {
    if (!supabase) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)."
      );
      setLoading(false);
      return;
    }

    if (!userId) {
      setGames([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("games")
      .select("*")
      .or(`user_id.eq.${userId},opponent_id.eq.${userId}`)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setGames((data ?? []).map(mapGame));
    setLoading(false);
  };

  useEffect(() => {
    void loadGames();
  }, [userId]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
      if (data.session?.user?.id && data.session.user.email) {
        void supabase
          .from("profiles")
          .upsert({ id: data.session.user.id, email: data.session.user.email }, { onConflict: "id" });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      if (session?.user?.id && session.user.email) {
        void supabase
          .from("profiles")
          .upsert({ id: session.user.id, email: session.user.email }, { onConflict: "id" });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !userId) {
      setProfiles([]);
      return;
    }

    const loadProfiles = async () => {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, email")
        .order("username", { ascending: true });
      if (profilesError) {
        setError(profilesError.message);
        return;
      }
      setProfiles(
        (data ?? [])
          .filter((profile) => profile.username)
          .map((profile) => ({
            id: profile.id,
            username: profile.username,
            email: profile.email,
          }))
      );
    };

    void loadProfiles();
  }, [userId]);

  const handleEmailSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)."
      );
      return;
    }

    setAuthLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    });
    if (authError) {
      setError(authError.message);
    }
    setAuthLoading(false);
  };

  const handleEmailSignUp = async () => {
    if (!supabase) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)."
      );
      return;
    }

    if (!authForm.username.trim()) {
      setError("Please choose a username.");
      return;
    }

    setAuthLoading(true);
    setError(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
    });
    if (authError) {
      setError(authError.message);
    } else if (data.user?.id) {
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: authForm.email.toLowerCase(),
          username: authForm.username.trim(),
        },
        { onConflict: "id" }
      );
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
    }
    setAuthLoading(false);
  };

  const isSignedIn = Boolean(userId);
  const teamA = form.format === "8-ball-2v2" ? `${form.playerA} & ${form.playerC}` : form.playerA;
  const teamB = form.format === "8-ball-2v2" ? `${form.playerB} & ${form.playerD}` : form.playerB;
  const teamAReady =
    form.format === "8-ball-2v2" ? form.playerA.trim() && form.playerC.trim() : form.playerA.trim();
  const teamBReady =
    form.format === "8-ball-2v2" ? form.playerB.trim() && form.playerD.trim() : form.playerB.trim();
  const winnerChoice =
    form.winner && form.winner === teamA ? "A" : form.winner === teamB ? "B" : "";

  const stats = useMemo(() => {
    const players = new Set<string>();
    const totals: Record<string, { wins: number; losses: number }> = {};

    games.forEach((game) => {
      const [sideA, sideB] = game.players;
      if (!sideA || !sideB || !game.winner) return;

      const splitPlayers = (name: string) =>
        name.includes(" & ") ? name.split(" & ").map((player) => player.trim()) : [name];

      const teamAPlayers = game.format === "8-ball-2v2" ? splitPlayers(sideA) : [sideA];
      const teamBPlayers = game.format === "8-ball-2v2" ? splitPlayers(sideB) : [sideB];

      [...teamAPlayers, ...teamBPlayers].forEach((player) => {
        if (!player) return;
        players.add(player);
        if (!totals[player]) totals[player] = { wins: 0, losses: 0 };
      });

      const winnerIsA = game.winner === sideA;
      if (!winnerIsA && game.winner !== sideB) {
        return;
      }
      const winningTeam = winnerIsA ? teamAPlayers : teamBPlayers;
      const losingTeam = winnerIsA ? teamBPlayers : teamAPlayers;

      winningTeam.forEach((player) => {
        if (totals[player]) totals[player].wins += 1;
      });
      losingTeam.forEach((player) => {
        if (totals[player]) totals[player].losses += 1;
      });
    });

    const leaderboard = Array.from(players).map((player) => {
      const record = totals[player] ?? { wins: 0, losses: 0 };
      const gamesPlayed = record.wins + record.losses;
      const winRate = gamesPlayed ? Math.round((record.wins / gamesPlayed) * 100) : 0;
      return {
        player,
        wins: record.wins,
        losses: record.losses,
        gamesPlayed,
        winRate,
      };
    });

    leaderboard.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

    return {
      totalGames: games.length,
      uniquePlayers: players.size,
      leaderboard,
    };
  }, [games]);

  const recentGames = useMemo(() => {
    return [...games]
      .sort((a, b) => {
        if (a.date === b.date) {
          return a.createdAt < b.createdAt ? 1 : -1;
        }
        return a.date < b.date ? 1 : -1;
      })
      .slice(0, 5);
  }, [games]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.playerA.trim() || !form.playerB.trim() || !form.winner.trim()) {
      return;
    }

    if (!supabase) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)."
      );
      return;
    }

    if (!userId) {
      setError("Please sign in to add games.");
      return;
    }

    setSaving(true);
    setError(null);

    if (form.format === "8-ball-2v2" && (!form.playerC.trim() || !form.playerD.trim())) {
      setError("Add both teammates for a 2v2 game.");
      return;
    }

    const opponentName = form.playerB.trim();
    const opponentProfile = profiles.find((profile) => profile.username === opponentName);
    if (!opponentProfile) {
      setError("Opponent account not found. Ask them to sign up first.");
      setSaving(false);
      return;
    }
    if (opponentProfile.email.toLowerCase() === userEmail?.toLowerCase()) {
      setError("Opponent cannot be your own account.");
      setSaving(false);
      return;
    }

    const payload = {
      date: form.date || new Date().toISOString().slice(0, 10),
      table_name: form.table,
      format: form.format,
      race_to: 1,
      player_a: teamA,
      player_b: teamB,
      winner: form.winner.trim(),
      score: form.score || "",
      user_id: userId,
      opponent_id: opponentProfile.id,
      opponent_email: opponentProfile.email,
    };

    const { data, error: insertError } = await supabase
      .from("games")
      .insert(payload)
      .select("*")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    if (data) {
      setGames((prev) => [mapGame(data), ...prev]);
    }

    setForm((prev) => ({
      ...prev,
      playerA: "",
      playerB: "",
      playerC: "",
      playerD: "",
      winner: "",
      score: "",
    }));
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,70,58,0.6),_transparent_55%),linear-gradient(135deg,_#0b0f0e,_#101b18,_#122723)] text-[15px] text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(202,164,104,0.35),_transparent_65%)] blur-3xl float-slow" />
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(20,70,58,0.55),_transparent_65%)] blur-3xl float-fast" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-80 w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(244,243,238,0.18),_transparent_70%)] blur-3xl" />

        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
          <header className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[conic-gradient(from_120deg,_#caa468,_#f4f3ee,_#14463a,_#caa468)] text-black shadow-[0_12px_30px_rgba(12,20,18,0.6)]">
                  <span className="font-[var(--font-display)] text-xl tracking-[0.2em]">BL</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#caa468] sm:text-xs sm:tracking-[0.45em]">
                    BreakLine
                  </p>
                  <h1 className="font-[var(--font-display)] text-3xl tracking-[0.05em] sm:text-5xl sm:tracking-[0.08em]">
                    Pool Game Tracker
                  </h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#f4f3ee] backdrop-blur sm:px-5 sm:text-xs sm:tracking-[0.3em]">
                  Live Session
                </div>
                {userEmail ? (
                  <button
                    onClick={handleSignOut}
                    disabled={authLoading}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs sm:tracking-[0.3em]"
                  >
                    Sign Out
                  </button>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-white/70 sm:text-xs sm:tracking-[0.3em]">
                    Sign In
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-white/60">
              {userEmail ? `Signed in as ${userEmail}` : "Use email and password to sign in or create an account."}
            </p>
            <p className="max-w-2xl text-base text-white/70">
              Track matches, formats, and player stats for your next league night. Add results in seconds,
              keep a running leaderboard, and share the story of each rack.
            </p>
          </header>

          {error && (
            <div className="rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              Supabase error: {error}
            </div>
          )}

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_24px_60px_rgba(7,10,9,0.6)] backdrop-blur sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
                  Session Overview
                </h2>
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#caa468] sm:text-xs sm:tracking-[0.3em]">
                  January 2026
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                    Total Games
                  </p>
                  <p className="mt-3 font-[var(--font-display)] text-3xl tracking-[0.15em]">{stats.totalGames}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                    Active Players
                  </p>
                  <p className="mt-3 font-[var(--font-display)] text-3xl tracking-[0.15em]">{stats.uniquePlayers}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                    Top Format
                  </p>
                  <p className="mt-3 font-[var(--font-display)] text-3xl tracking-[0.15em]">8-Ball</p>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.3em] text-white/60 sm:text-sm sm:tracking-[0.4em]">
                    Recent Games
                  </h3>
                  <button className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] sm:text-xs sm:tracking-[0.3em]">
                    Export
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {loading ? (
                    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-white/70">
                      Loading games from Supabase...
                    </div>
                  ) : recentGames.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-white/70">
                      No games yet. Add the first result to start tracking.
                    </div>
                  ) : (
                    recentGames.map((game) => (
                      <div
                        key={game.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm uppercase tracking-[0.3em] text-[#caa468]">{formatLabels[game.format]}</p>
                          <p className="mt-1 text-base">
                            {game.players[0]} vs {game.players[1]}
                          </p>
                        <p className="text-xs text-white/60">{game.table}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-white/70">Winner</p>
                          <p className="font-[var(--font-display)] text-2xl tracking-[0.12em]">{game.winner}</p>
                          <p className="text-xs text-white/50">{game.date} • {game.score || "—"}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {!userEmail && (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6">
                  <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
                    Sign In
                  </h3>
                  <p className="mt-2 text-sm text-white/60">Use your email and password to continue.</p>
                  <form className="mt-4 space-y-4" onSubmit={handleEmailSignIn} data-testid="auth-form">
                    <label className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        value={authForm.email}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white sm:py-2 sm:text-sm"
                      />
                    </label>
                    <label className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                      Username
                      <input
                        type="text"
                        autoComplete="username"
                        value={authForm.username}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, username: event.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white sm:py-2 sm:text-sm"
                      />
                    </label>
                    <label className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                      Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={authForm.password}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white sm:py-2 sm:text-sm"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full rounded-2xl border border-[#caa468] bg-[#caa468] px-4 py-3 text-xs uppercase tracking-[0.3em] text-black transition hover:translate-y-[-1px] hover:shadow-[0_12px_30px_rgba(202,164,104,0.45)] disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm sm:tracking-[0.35em]"
                      >
                        {authLoading ? "Signing In..." : "Sign In"}
                      </button>
                      <button
                        type="button"
                        onClick={handleEmailSignUp}
                        disabled={authLoading}
                        className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm sm:tracking-[0.35em]"
                      >
                        {authLoading ? "Creating..." : "Create Account"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6">
                <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
                  Leaderboard
                </h3>
                <div className="mt-6 space-y-4">
                  {stats.leaderboard.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-6 text-sm text-white/70">
                      Add games to generate a leaderboard.
                    </div>
                  ) : (
                    stats.leaderboard.map((player, index) => (
                      <div
                        key={player.player}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3"
                      >
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-white/60">#{index + 1}</p>
                          <p className="text-lg font-medium">{player.player}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.3em] text-white/60">{player.winRate}% Win</p>
                          <p className="text-sm text-white/70">
                            {player.wins}W • {player.losses}L
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                id="quick-add"
                className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6"
              >
                <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
                  Quick Add
                </h3>
                <p className="mt-2 text-sm text-white/60">
                  Choose a mode, enter the two players, and tap a winner.
                </p>
                {!isSignedIn && (
                  <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/70">
                    Sign in to save games to your account.
                  </p>
                )}
                <form className="mt-4 space-y-4" onSubmit={handleSubmit} data-testid="quick-add-form">
                  <div className="grid gap-4">
                    <div className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                      Game Mode
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, format: "8-ball" }))}
                          disabled={!isSignedIn || saving}
                          className={`rounded-xl border px-3 py-3 text-xs uppercase tracking-[0.25em] transition sm:text-sm ${
                            form.format === "8-ball"
                              ? "border-[#caa468] bg-[#caa468] text-black"
                              : "border-white/10 bg-black/40 text-white"
                          }`}
                        >
                          8-Ball
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, format: "8-ball-2v2" }))}
                          disabled={!isSignedIn || saving}
                          className={`rounded-xl border px-3 py-3 text-xs uppercase tracking-[0.25em] transition sm:text-sm ${
                            form.format === "8-ball-2v2"
                              ? "border-[#caa468] bg-[#caa468] text-black"
                              : "border-white/10 bg-black/40 text-white"
                          }`}
                        >
                          2v2 8-Ball
                        </button>
                      </div>
                      <p className="text-[11px] normal-case tracking-normal text-white/50">
                        Single game only (no races).
                      </p>
                    </div>
                    <label className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                      {form.format === "8-ball-2v2" ? "Team A • Player 1" : "Player 1"}
                      <select
                        value={form.playerA}
                        onChange={(event) =>
                          setForm((prev) => {
                            const nextPlayerA = event.target.value;
                            const prevTeamA =
                              prev.format === "8-ball-2v2"
                                ? `${prev.playerA} & ${prev.playerC}`
                                : prev.playerA;
                            const nextTeamA =
                              prev.format === "8-ball-2v2"
                                ? `${nextPlayerA} & ${prev.playerC}`
                                : nextPlayerA;
                            return {
                              ...prev,
                              playerA: nextPlayerA,
                              winner: prev.winner === prevTeamA ? nextTeamA : prev.winner,
                            };
                          })
                        }
                        disabled={!isSignedIn || saving}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white sm:py-2 sm:text-sm"
                      >
                        <option value="">Select player</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.username}>
                            {profile.username}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                      {form.format === "8-ball-2v2" ? "Team B • Player 1" : "Player 2"}
                      <select
                        value={form.playerB}
                        onChange={(event) =>
                          setForm((prev) => {
                            const nextPlayerB = event.target.value;
                            const prevTeamB =
                              prev.format === "8-ball-2v2"
                                ? `${prev.playerB} & ${prev.playerD}`
                                : prev.playerB;
                            const nextTeamB =
                              prev.format === "8-ball-2v2"
                                ? `${nextPlayerB} & ${prev.playerD}`
                                : nextPlayerB;
                            return {
                              ...prev,
                              playerB: nextPlayerB,
                              winner: prev.winner === prevTeamB ? nextTeamB : prev.winner,
                            };
                          })
                        }
                        disabled={!isSignedIn || saving}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white sm:py-2 sm:text-sm"
                      >
                        <option value="">Select player</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.username}>
                            {profile.username}
                          </option>
                        ))}
                      </select>
                    </label>
                    {form.format === "8-ball-2v2" && (
                      <>
                        <label className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                          Team A • Player 2
                          <select
                            value={form.playerC}
                            onChange={(event) =>
                              setForm((prev) => {
                                const nextPlayerC = event.target.value;
                                const prevTeamA = `${prev.playerA} & ${prev.playerC}`;
                                const nextTeamA = `${prev.playerA} & ${nextPlayerC}`;
                                return {
                                  ...prev,
                                  playerC: nextPlayerC,
                                  winner: prev.winner === prevTeamA ? nextTeamA : prev.winner,
                                };
                              })
                            }
                            disabled={!isSignedIn || saving}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white sm:py-2 sm:text-sm"
                          >
                            <option value="">Select player</option>
                            {profiles.map((profile) => (
                              <option key={profile.id} value={profile.username}>
                                {profile.username}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                          Team B • Player 2
                          <select
                            value={form.playerD}
                            onChange={(event) =>
                              setForm((prev) => {
                                const nextPlayerD = event.target.value;
                                const prevTeamB = `${prev.playerB} & ${prev.playerD}`;
                                const nextTeamB = `${prev.playerB} & ${nextPlayerD}`;
                                return {
                                  ...prev,
                                  playerD: nextPlayerD,
                                  winner: prev.winner === prevTeamB ? nextTeamB : prev.winner,
                                };
                              })
                            }
                            disabled={!isSignedIn || saving}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base text-white sm:py-2 sm:text-sm"
                          >
                            <option value="">Select player</option>
                            {profiles.map((profile) => (
                              <option key={profile.id} value={profile.username}>
                                {profile.username}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    <div className="space-y-2 text-[10px] uppercase tracking-[0.25em] text-white/60 sm:text-xs sm:tracking-[0.3em]">
                      Winner
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, winner: teamA }))}
                          disabled={!isSignedIn || saving || !teamAReady}
                          className={`rounded-xl border px-3 py-3 text-xs uppercase tracking-[0.25em] transition sm:text-sm ${
                            winnerChoice === "A"
                              ? "border-[#caa468] bg-[#caa468] text-black"
                              : "border-white/10 bg-black/40 text-white"
                          }`}
                        >
                          {form.format === "8-ball-2v2" ? "Team A Wins" : "Player 1 Wins"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, winner: teamB }))}
                          disabled={!isSignedIn || saving || !teamBReady}
                          className={`rounded-xl border px-3 py-3 text-xs uppercase tracking-[0.25em] transition sm:text-sm ${
                            winnerChoice === "B"
                              ? "border-[#caa468] bg-[#caa468] text-black"
                              : "border-white/10 bg-black/40 text-white"
                          }`}
                        >
                          {form.format === "8-ball-2v2" ? "Team B Wins" : "Player 2 Wins"}
                        </button>
                      </div>
                      <p className="text-[11px] normal-case tracking-normal text-white/50">
                        Choose a winner to save the game.
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!isSignedIn || saving}
                    className="w-full rounded-2xl border border-[#caa468] bg-[#caa468] px-4 py-4 text-xs uppercase tracking-[0.3em] text-black transition hover:translate-y-[-1px] hover:shadow-[0_12px_30px_rgba(202,164,104,0.45)] disabled:cursor-not-allowed disabled:opacity-70 sm:py-3 sm:text-sm sm:tracking-[0.35em]"
                  >
                    {saving ? "Saving..." : "Add Game Result"}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
                  Session Notes
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-white/60">
                  Capture table conditions, cue changes, or special runs so you remember why tonight mattered.
                </p>
              </div>
              <button className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] sm:text-xs sm:tracking-[0.3em]">
                Add Note
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                "Table 2 is playing fast with the new cloth.",
                "Kai ran out twice on the break during 9-ball.",
                "Amaya prefers the red 12.5mm tip for jump shots.",
              ].map((note) => (
                <div key={note} className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
                  {note}
                </div>
              ))}
            </div>
          </section>
        </main>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/60 px-4 py-3 backdrop-blur sm:hidden">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">Quick Add</div>
            {isSignedIn ? (
              <a
                href="#quick-add"
                className="rounded-full bg-[#caa468] px-4 py-2 text-xs uppercase tracking-[0.3em] text-black transition"
              >
                Add Game
              </a>
            ) : (
              <span className="rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
                Sign In to Add
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
