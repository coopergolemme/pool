"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { GameForm } from "../../components/GameForm";
import { type Game } from "../../lib/glicko";
import { AuthForm, type AuthFormData } from "../../components/AuthForm";
import { Skeleton } from "../../components/ui/Skeleton";

interface Profile {
  id: string;
  username: string;
  email: string;
}



export default function AddGamePage() {

  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requireVerification, setRequireVerification] = useState(true);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

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
    ballsRemaining: "3",
  });

  const fetchSession = async () => {
    const res = await fetch("/api/auth/session", { method: "GET", cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.user) {
      return { id: null as string | null };
    }
    return { id: data.user.id ?? null };
  };

  const fetchRequireVerificationConfig = async () => {
    const res = await fetch("/api/config?key=require_verification", {
      method: "GET",
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok && typeof data.value === "boolean") {
      return data.value;
    }
    return true;
  };

  const fetchProfiles = async () => {
    const res = await fetch("/api/profiles", {
      method: "GET",
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data.profiles)) {
      return data.profiles as Profile[];
    }
    return [];
  };

  const applySessionAndProfiles = (sessionUserId: string | null, profileRows: Profile[]) => {
    setUserId(sessionUserId);
    setProfiles(profileRows);

    if (sessionUserId) {
      const userProfile = profileRows.find((p) => p.id === sessionUserId);
      if (userProfile) {
        setForm((prev) => ({ ...prev, playerA: userProfile.username }));
      }
    }
  };

  useEffect(() => {
    let canceled = false;

    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        const [session, configValue, profileRows] = await Promise.all([
          fetchSession(),
          fetchRequireVerificationConfig(),
          fetchProfiles(),
        ]);

        if (canceled) return;
        setRequireVerification(configValue);
        applySessionAndProfiles(session.id, profileRows);
      } finally {
        if (!canceled) setIsBootstrapping(false);
      }
    };

    void bootstrap();
    return () => {
      canceled = true;
    };
  }, []);

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
        const [session, profileRows] = await Promise.all([fetchSession(), fetchProfiles()]);
        applySessionAndProfiles(session.id, profileRows);
      }
    } catch {
      setError("Sign in failed");
    }
    setAuthLoading(false);
  };

  const handleSignUp = async (authForm: AuthFormData) => {
    if (!authForm.username) return setError("Username required");

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
      } else if (data.requiresApproval) {
        setError(
          data.needsEmailConfirmation
            ? "Check your email to confirm, then wait for admin approval before signing in."
            : "Account created. Please wait for an admin to approve your account before signing in.",
        );
      } else if (data.needsEmailConfirmation) {
        setError("Check your email to confirm your account before signing in.");
      } else {
        const [session, profileRows] = await Promise.all([fetchSession(), fetchProfiles()]);
        applySessionAndProfiles(session.id, profileRows);
      }
    } catch {
      setError("Sign up failed");
    }
    setAuthLoading(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;

    setSaving(true);
    setError(null);

    // Basic Validation
    if (!form.playerA || !form.playerB || !form.winner) {
      setSaving(false);
      return;
    }

    const opponentName = form.playerB;
    const opponent = profiles.find(p => p.username === opponentName);

    if (!opponent) {
      setError("Opponent not found");
      setSaving(false);
      return;
    }

    const teamA = form.format === "8-ball-2v2" ? `${form.playerA} & ${form.playerC}` : form.playerA;
    const teamB = form.format === "8-ball-2v2" ? `${form.playerB} & ${form.playerD}` : form.playerB;

    const payload = {
      date: form.date || new Date().toISOString().slice(0, 10),
      table_name: form.table,
      format: form.format,
      race_to: 1,
      player_a: teamA,
      player_b: teamB,
      winner: form.winner,
      score: form.score || "",
      opponent_id: opponent.id,
      opponent_email: opponent.email,
      status: requireVerification ? "pending" : "verified",
      balls_remaining: form.ballsRemaining ? parseInt(form.ballsRemaining) : null,
    };

    const response = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Failed to create game");
    } else {
      const msg = requireVerification
        ? "Game submitted! Waiting for opponent verification."
        : "Game added successfully!";

      toast.success(msg);
      setForm(prev => ({ ...prev, winner: "", score: "" }));

      // Trigger Push Notification to opponent
      if (requireVerification && opponent.id) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: opponent.id,
            title: "New Game to Verify! 🎱",
            body: `${form.playerA} submitted a game against you.`,
            url: "/"
          })
        }).catch(err => console.error("Failed to send push notification:", err));
      }
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6 pb-32 sm:pb-6">
      <div className="mb-8 text-center">
        <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-widest text-white sm:text-6xl">
          Add Game
        </h1>
        <p className="mt-2 text-white/50">Record a new match result</p>
      </div>

      {isBootstrapping ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6 min-h-[320px]">
          <Skeleton className="h-8 w-1/2 mb-4" />
          <Skeleton className="h-10 w-full mb-3" />
          <Skeleton className="h-10 w-full mb-3" />
          <Skeleton className="h-10 w-2/3 mb-8" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : !userId ? (
        <AuthForm
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          loading={authLoading}
          error={error}
        />
      ) : (
        <>
          {error && <div className="mb-4 rounded bg-red-500/10 p-4 text-red-200 border border-red-500/20">{error}</div>}

          <GameForm
            form={form}
            setForm={setForm}
            profiles={profiles}
            isSignedIn={!!userId}
            saving={saving}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  );
}
