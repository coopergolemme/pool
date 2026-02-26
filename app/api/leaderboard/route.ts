import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { type RatingTrack } from "@/lib/rating-track";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const formatParam = searchParams.get("format");
    const format: RatingTrack = formatParam === "9-ball" ? "9-ball" : "8-ball";
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;

    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }

    const limit = Math.min(parsedLimit, MAX_LIMIT);
    const getLeaderboard = unstable_cache(
      async (requestedLimit: number, requestedFormat: RatingTrack) => {
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "username, rating, rd, wins, losses, streak, rating_9ball, rd_9ball, wins_9ball, losses_9ball, streak_9ball",
          )
          .eq("approved", true)
          .not("username", "is", null)
          .order(requestedFormat === "9-ball" ? "rating_9ball" : "rating", { ascending: false })
          .limit(requestedLimit);

        if (error) throw error;

        return (data ?? [])
          .map((row) => {
            const wins = requestedFormat === "9-ball" ? (row.wins_9ball ?? 0) : (row.wins ?? 0);
            const losses = requestedFormat === "9-ball" ? (row.losses_9ball ?? 0) : (row.losses ?? 0);
            const gamesPlayed = wins + losses;
            const winRate = gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0;
            return {
              player: row.username as string,
              rating: Math.round(
                toNumber(requestedFormat === "9-ball" ? row.rating_9ball : row.rating),
              ),
              rd: Math.round(toNumber(requestedFormat === "9-ball" ? row.rd_9ball : row.rd)),
              wins,
              losses,
              streak: requestedFormat === "9-ball" ? (row.streak_9ball ?? 0) : (row.streak ?? 0),
              gamesPlayed,
              winRate,
            };
          })
          .filter((p) => p.gamesPlayed > 0)
          .sort((a, b) => b.rating - a.rating || b.winRate - a.winRate);
      },
      ["api-leaderboard"],
      { revalidate: 60, tags: [CACHE_TAGS.leaderboard, CACHE_TAGS.profiles] },
    );

    const leaderboard = await getLeaderboard(limit, format);

    return NextResponse.json(
      { leaderboard, format },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
