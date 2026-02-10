"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { GameForm } from "../../components/GameForm";
import { type Game } from "../../lib/glicko";
import { AuthForm, type AuthFormData } from "../../components/AuthForm";

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
      setUserId(null);
      return;
    }
    setUserId(data.user.id ?? null);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      const res = await fetch("/api/config?key=require_verification", {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && typeof data.value === "boolean") {
        setRequireVerification(data.value);
      } else {
        setRequireVerification(true);
      }
    };

    void fetchConfig();
    setTimeout(() => {
      void fetchSession();
    }, 0);

    const loadProfiles = async () => {
      const res = await fetch("/api/profiles", {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.profiles)) {
        setProfiles(data.profiles);
        // Auto-select signed-in user
        if (userId) {
          const userProfile = data.profiles.find((p: Profile) => p.id === userId);
          if (userProfile) {
            setForm(prev => ({ ...prev, playerA: userProfile.username }));
          }
        }
      } else {
        setProfiles([]);
      }
    };

    loadProfiles();
  }, [userId]);

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
      } else if (data.needsEmailConfirmation) {
        setError("Check your email to confirm your account before signing in.");
      } else {
        await fetchSession();
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
    if (!form.playerA || !form.playerB || !form.winner) return;

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

      {!userId ? (
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
