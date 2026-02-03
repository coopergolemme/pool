
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { computeRatings } from "../lib/glicko";
import { mapGame, DbGame } from "../lib/types";

// Re-implement createAdminClient to avoid alias issues if running via tsx without path alias resolution setup for scripts
// or just use relative path imports which assumes we are compatible.
// But better to just inline the client creation if simple.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("Starting backfill...");
  
  // Fetch all verified games
  const { data: gamesData, error: gamesError } = await supabase
    .from("games")
    .select("*")
    .eq("status", "verified");
    
  if (gamesError || !gamesData) {
    console.error("Error fetching games:", gamesError);
    return;
  }
  
  console.log(`Found ${gamesData.length} verified games.`);

  const games = gamesData.map((g) => mapGame(g as DbGame));
  const players = computeRatings(games);

  // Fetch all profiles to map username -> id
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, email");
    
  if (profilesError || !profiles) {
    console.error("Error fetching profiles:", profilesError);
    return;
  }

  const updates = [];
  for (const [username, stats] of players.entries()) {
    const profile = profiles.find((p) => p.username === username);
    if (profile) {
      updates.push({
        id: profile.id,
        email: profile.email,
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

  // Batch update
  if (updates.length > 0) {
    const { error } = await supabase.from("profiles").upsert(updates);
    if (error) {
        console.error("Update failed:", error);
    } else {
        console.log("Successfully updated profiles.");
    }
  }
}

main().catch(console.error);
