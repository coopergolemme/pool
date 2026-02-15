import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { runRatingsBackfill } from "../lib/backfill-ratings";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("Starting rating + rating history backfill...");
  const result = await runRatingsBackfill(supabase);
  console.log(`Processed ${result.gamesProcessed} games.`);
  console.log(`Updated ${result.profilesUpdated} profiles.`);
  console.log(`Upserted ${result.ratingChangesUpserted} rating history rows.`);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
