import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRatings } from "@/lib/glicko";
import { mapGame, DbGame } from "@/lib/types";

export const dynamic = 'force-dynamic'; // Ensure this function is not cached

export async function GET(request: Request) {
  // Security Check: Verify Vercel Cron Secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    console.log("Starting nightly rating backfill...");

    // 1. Fetch all verified games
    const { data: gamesData, error: gamesError } = await supabase
      .from("games")
      .select("*")
      .eq("status", "verified")
      .order("created_at", { ascending: true }); // Important: Order by date to replay history correctly

    if (gamesError || !gamesData) {
      console.error("Error fetching games:", gamesError);
      return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
    }

    console.log(`Found ${gamesData.length} verified games.`);

    const games = gamesData.map((g) => mapGame(g as DbGame));
    
    // 2. Compute Ratings
    const players = computeRatings(games);

    // 3. Fetch all profiles to map username -> id
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, email");

    if (profilesError || !profiles) {
      console.error("Error fetching profiles:", profilesError);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
    }

    // 4. Prepare Updates
    const updates = [];
    for (const [username, stats] of players.entries()) {
      const profile = profiles.find((p) => p.username === username);
      if (profile) {
        updates.push({
          id: profile.id,
          email: profile.email,
          username: username, // Ensure username is included for upsert
          rating: stats.rating,
          rd: stats.rd,
          vol: stats.vol,
          wins: stats.wins,
          losses: stats.losses,
          streak: stats.streak,
        });
      } else {
        console.warn(`Profile not found for user: ${username}`);
      }
    }

    console.log(`Computed ${updates.length} profile updates.`);

    // 5. Batch Update
    if (updates.length > 0) {
      const { error: updateError } = await supabase.from("profiles").upsert(updates);
      if (updateError) {
        console.error("Update failed:", updateError);
        return NextResponse.json({ error: "Failed to update profiles" }, { status: 500 });
      }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Processed ${gamesData.length} games and updated ${updates.length} profiles.` 
    });

  } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Backfill error:", error);
      return NextResponse.json({ error: msg }, { status: 500 });
  }
}
