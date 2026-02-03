import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DbGame } from "@/lib/types";


export async function POST(request: Request) {
  try {
    const { gameId, action, userId } = await request.json();
    
    if (!gameId || !action || !userId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch the game to verify permission
    const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();
    
    if (gameError || !gameData) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const game = gameData as DbGame;

    // Check permissions: User must be the opponent
    if (game.opponent_id && game.opponent_id !== userId) {
         return NextResponse.json({ error: "Unauthorized: You are not the opponent" }, { status: 403 });
    }

    // 2. Perform Action
    if (action === "accept") {
        const { error: updateError } = await supabase
            .from("games")
            .update({ status: "verified" })
            .eq("id", gameId);
        
        if (updateError) throw updateError;
    } else if (action === "reject") {
        const { error: deleteError } = await supabase
            .from("games")
            .delete()
            .eq("id", gameId);
             
        if (deleteError) throw deleteError;
        
        // If rejected, no need to update ratings as pending games don't affect ratings
        return NextResponse.json({ success: true });
    } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // 3. Incremental Rating Update
    const is2v2 = game.format === "8-ball-2v2";
    if (game.player_a && game.player_b && game.winner) {
      const { parseTeam, calculateNewRatings, DEFAULT_RATING, DEFAULT_RD, DEFAULT_VOL } = await import("@/lib/glicko");

      const teamAPlayers = parseTeam(game.player_a, is2v2);
      const teamBPlayers = parseTeam(game.player_b, is2v2);
      const allPlayerNames = [...teamAPlayers, ...teamBPlayers];

      // Fetch profiles for these players
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .in("username", allPlayerNames);

      if (!profileError && profiles) {
        const profileMap = new Map(profiles.map(p => [p.username, {
          rating: Number(p.rating),
          rd: Number(p.rd),
          vol: Number(p.vol),
          wins: p.wins || 0,
          losses: p.losses || 0,
          streak: p.streak || 0
        }]));

        const getStats = (name: string) => profileMap.get(name) || {
          rating: DEFAULT_RATING, rd: DEFAULT_RD, vol: DEFAULT_VOL, wins: 0, losses: 0, streak: 0
        };

        const teamARating = teamAPlayers.reduce((sum, name) => sum + getStats(name).rating, 0) / teamAPlayers.length;
        const teamBRD = teamBPlayers.reduce((sum, name) => sum + getStats(name).rd, 0) / teamBPlayers.length;
        
        const teamBRating = teamBPlayers.reduce((sum, name) => sum + getStats(name).rating, 0) / teamBPlayers.length;
        const teamARD = teamAPlayers.reduce((sum, name) => sum + getStats(name).rd, 0) / teamAPlayers.length;

        const teamAIsWinner = game.winner === game.player_a;
        const scoreA = teamAIsWinner ? 1 : 0;
        const scoreB = teamAIsWinner ? 0 : 1;

        type ProfileUpdate = {
          id: string;
          rating: number;
          rd: number;
          vol: number;
          wins: number;
          losses: number;
          streak: number;
        };

        const updates: ProfileUpdate[] = [];

        teamAPlayers.forEach(name => {
          const profile = profiles.find(p => p.username === name);
          if (profile) {
            const newStats = calculateNewRatings(getStats(name), teamBRating, teamBRD, scoreA);
            updates.push({
              id: profile.id,
              rating: newStats.rating,
              rd: newStats.rd,
              vol: newStats.vol,
              wins: newStats.wins,
              losses: newStats.losses,
              streak: newStats.streak
            });
          }
        });

        teamBPlayers.forEach(name => {
          const profile = profiles.find(p => p.username === name);
          if (profile) {
            const newStats = calculateNewRatings(getStats(name), teamARating, teamARD, scoreB);
            updates.push({
              id: profile.id,
              rating: newStats.rating,
              rd: newStats.rd,
              vol: newStats.vol,
              wins: newStats.wins,
              losses: newStats.losses,
              streak: newStats.streak
            });
          }
        });

        if (updates.length > 0) {
          const { error: upsertError } = await supabase.from("profiles").upsert(updates);
          if (upsertError) console.error("Rating update failed", upsertError);
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Verification error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
