"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase/client";
import { GameForm } from "../../components/GameForm";
import { computeRatings, DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOL, type Game } from "../../lib/glicko";
import { mapGame } from "../../lib/types";
import { AuthForm } from "../../components/AuthForm";

export default function AddGamePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });

    const loadProfiles = async () => {
      if (!supabase) return;
      
      const { data } = await supabase
        .from("profiles")
        .select("id, username, email")
        .order("username");
      if (data) {
        setProfiles(data);
        // Auto-select signed-in user
        if (userId) {
            const userProfile = data.find((p) => p.id === userId);
            if (userProfile) {
                setForm(prev => ({ ...prev, playerA: userProfile.username }));
            }
        }
      }
    };

    loadProfiles();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [userId]); 

  const handleSignIn = async (authForm: any) => {
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    });
    if (error) setError(error.message);
    setAuthLoading(false);
  };

  const handleSignUp = async (authForm: any) => {
    if (!supabase) return;
    if (!authForm.username) return setError("Username required");
    
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
    });
    
    if (error) {
      setError(error.message);
    } else if (data.user?.id) {
       await supabase.from("profiles").upsert(
        { id: data.user.id, email: authForm.email, username: authForm.username },
        { onConflict: "id" }
      );
    }
    setAuthLoading(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !userId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

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
      user_id: userId,
      opponent_id: opponent.id,
      opponent_email: opponent.email,
      status: "pending",
      submitted_by: userId,
      balls_remaining: form.ballsRemaining ? parseInt(form.ballsRemaining) : null,
    };

    const { error: insertError } = await supabase.from("games").insert(payload);

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess("Game submitted! Waiting for opponent verification.");
      toast.success("Game submitted successfully!");
      setForm(prev => ({ ...prev, winner: "", score: "" }));
       // Update ratings in background
       updateRatings();
    }
    setSaving(false);
  };

  const updateRatings = async () => {
     if (!supabase) return;
     // Re-fetch all games to compute fresh ratings
    const { data: allGames } = await supabase.from("games").select("*");
    if (allGames) {
        const mapped = allGames.map(mapGame);
        const ratings = computeRatings(mapped);
        const updates = Array.from(ratings.entries()).map(([player, record]) => {
            const profile = profiles.find((p) => p.username === player);
            if (!profile) return null;
            return {
              id: profile.id,
              rating: record.rating,
              rd: record.rd,
              vol: record.vol,
              streak: record.streak,
            };
        }).filter(Boolean);
        
        if (updates.length > 0) {
           const { error } = await supabase.from("profiles").upsert(updates);
           if (error) console.error("Error updating ratings/streaks", error);
        }
    }
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
        <AuthForm onSignIn={handleSignIn} onSignUp={handleSignUp} loading={authLoading} />
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
