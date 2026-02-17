import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

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
    const username = searchParams.get("username");
    const profileId = searchParams.get("profileId");
    const gameId = searchParams.get("gameId");
    const gameIdsParam = searchParams.get("gameIds");
    const gameIds = gameIdsParam
      ? gameIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : [];
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;

    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      return NextResponse.json(
        { error: "Invalid limit. Provide a positive integer." },
        { status: 400 },
      );
    }

    const limit = Math.min(parsedLimit, MAX_LIMIT);
    const getRatingHistory = unstable_cache(
      async (
        requestedLimit: number,
        requestedUsername: string | null,
        requestedProfileId: string | null,
        requestedGameId: string | null,
        requestedGameIds: string[],
      ) => {
        const supabase = createAdminClient();
        let query = supabase
          .from("game_rating_changes")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(requestedLimit);

        if (requestedUsername) query = query.eq("username", requestedUsername);
        if (requestedProfileId) query = query.eq("profile_id", requestedProfileId);
        if (requestedGameId) query = query.eq("game_id", requestedGameId);
        if (requestedGameIds.length > 0) query = query.in("game_id", requestedGameIds);

        const { data, error } = await query;
        if (error) throw error;

        return (data ?? []).map((row) => ({
          id: row.id,
          gameId: row.game_id,
          profileId: row.profile_id,
          username: row.username,
          format: row.format,
          result: row.result,
          preRating: toNumber(row.pre_rating),
          postRating: toNumber(row.post_rating),
          ratingDelta: toNumber(row.rating_delta),
          preRd: toNumber(row.pre_rd),
          postRd: toNumber(row.post_rd),
          rdDelta: toNumber(row.rd_delta),
          preVol: toNumber(row.pre_vol),
          postVol: toNumber(row.post_vol),
          volDelta: toNumber(row.vol_delta),
          createdAt: row.created_at,
        }));
      },
      ["api-rating-history"],
      { revalidate: 60, tags: [CACHE_TAGS.ratingHistory] },
    );

    const changes = await getRatingHistory(limit, username, profileId, gameId, gameIds);

    return NextResponse.json(
      { changes },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching rating history:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
