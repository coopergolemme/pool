import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapGame, DbGame } from "@/lib/types";
import { computeRatings } from "@/lib/glicko";

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

const { data: allGames } = await supabase.from("games").select("*");
    const { data: allProfiles } = await supabase.from("profiles").select("id, username");

    if (allGames && allProfiles) {
        const games = allGames.map((g) => mapGame(g as DbGame));
        const ratings = computeRatings(games);

        const updates = Array.from(ratings.entries()).map(([username, stats]) => {
            const profile = allProfiles.find((p: { username: string; id: string }) => p.username === username);
            if (!profile) return null;
            return {
                id: profile.id,
                rating: stats.rating,
                rd: stats.rd,
                vol: stats.vol,
                streak: stats.streak
            };
        }).filter(Boolean);

        if (updates.length > 0) {
            const { error: upsertError } = await supabase.from("profiles").upsert(updates);
            if (upsertError) console.error("Rating update failed", upsertError);
        }
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Verification error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
