import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DbGame } from "@/lib/types";
import { getAuthUserFromRequest, setAuthCookies } from "@/lib/supabase/server-auth";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, profileTag } from "@/lib/cache-tags";


export async function POST(request: Request) {
  try {
    const { gameId, action } = await request.json();
    
    if (!gameId || !action) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { user, refreshed } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

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

    // Check permissions: User must be the opponent OR an admin
    const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

    const isAdmin = requesterProfile?.role === "ADMIN";

    if (!isAdmin && game.opponent_id && game.opponent_id !== userId) {
         return NextResponse.json({ error: "Unauthorized: You are not the opponent" }, { status: 403 });
    }

    // 2. Perform Action
    if (action === "accept") {
        const { error: updateError } = await supabase
            .from("games")
            .update({ status: "verified" })
            .eq("id", gameId);
        
        if (updateError) throw updateError;
        revalidateTag(CACHE_TAGS.games, "max");
    } else if (action === "reject") {
        const { error: deleteError } = await supabase
            .from("games")
            .delete()
            .eq("id", gameId);
             
        if (deleteError) throw deleteError;
        
        // If rejected, no need to update ratings as pending games don't affect ratings
        revalidateTag(CACHE_TAGS.games, "max");
        const response = NextResponse.json({ success: true });
        if (refreshed) {
          setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
        }
        return response;
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
        const ratingChanges: Array<{
          game_id: string;
          profile_id: string;
          username: string;
          format: string;
          result: "win" | "loss";
          pre_rating: number;
          post_rating: number;
          pre_rd: number;
          post_rd: number;
          pre_vol: number;
          post_vol: number;
        }> = [];

        teamAPlayers.forEach(name => {
          const profile = profiles.find(p => p.username === name);
          if (profile) {
            const previous = getStats(name);
            const newStats = calculateNewRatings(previous, teamBRating, teamBRD, scoreA);
            updates.push({
              id: profile.id,
              rating: newStats.rating,
              rd: newStats.rd,
              vol: newStats.vol,
              wins: newStats.wins,
              losses: newStats.losses,
              streak: newStats.streak
            });
            ratingChanges.push({
              game_id: game.id,
              profile_id: profile.id,
              username: name,
              format: game.format ?? "8-ball",
              result: scoreA === 1 ? "win" : "loss",
              pre_rating: previous.rating,
              post_rating: newStats.rating,
              pre_rd: previous.rd,
              post_rd: newStats.rd,
              pre_vol: previous.vol,
              post_vol: newStats.vol,
            });
          }
        });

        teamBPlayers.forEach(name => {
          const profile = profiles.find(p => p.username === name);
          if (profile) {
            const previous = getStats(name);
            const newStats = calculateNewRatings(previous, teamARating, teamARD, scoreB);
            updates.push({
              id: profile.id,
              rating: newStats.rating,
              rd: newStats.rd,
              vol: newStats.vol,
              wins: newStats.wins,
              losses: newStats.losses,
              streak: newStats.streak
            });
            ratingChanges.push({
              game_id: game.id,
              profile_id: profile.id,
              username: name,
              format: game.format ?? "8-ball",
              result: scoreB === 1 ? "win" : "loss",
              pre_rating: previous.rating,
              post_rating: newStats.rating,
              pre_rd: previous.rd,
              post_rd: newStats.rd,
              pre_vol: previous.vol,
              post_vol: newStats.vol,
            });
          }
        });

        if (updates.length > 0) {
          const { error: upsertError } = await supabase.from("profiles").upsert(updates);
          if (upsertError) console.error("Rating update failed", upsertError);
        }

        if (ratingChanges.length > 0) {
          const { error: historyError } = await supabase
            .from("game_rating_changes")
            .upsert(ratingChanges, { onConflict: "game_id,profile_id" });
          if (historyError) console.error("Rating history insert failed", historyError);
        }

        revalidateTag(CACHE_TAGS.games, "max");
        revalidateTag(CACHE_TAGS.leaderboard, "max");
        revalidateTag(CACHE_TAGS.streaks, "max");
        revalidateTag(CACHE_TAGS.ratingHistory, "max");
        revalidateTag(CACHE_TAGS.profiles, "max");
        for (const name of new Set(allPlayerNames)) {
          revalidateTag(profileTag(name), "max");
        }
      }
    }

    const response = NextResponse.json({ success: true });
    if (refreshed) {
      setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
    }
    return response;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Verification error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
