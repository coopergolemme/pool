import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache, revalidateTag } from "next/cache";
import { CACHE_TAGS, profileTag, userPendingTag } from "@/lib/cache-tags";
import { parseTeam } from "@/lib/glicko";
import { requireApprovedProfile, setRefreshedCookiesIfNeeded } from "@/lib/auth/require-approved-profile";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 400;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;

    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      return NextResponse.json(
        { error: "Invalid limit. Provide a positive integer." },
        { status: 400 },
      );
    }

    const limit = Math.min(parsedLimit, MAX_LIMIT);
    const getGames = unstable_cache(
      async (requestedLimit: number) => {
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from("games")
          .select("*")
          .eq("status", "verified")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(requestedLimit);

        if (error) throw error;
        return data ?? [];
      },
      ["api-games-list"],
      { revalidate: 30, tags: [CACHE_TAGS.games] },
    );

    return NextResponse.json(
      { games: await getGames(limit) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching games:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateGamePayload = {
  date?: string;
  table_name?: string;
  format?: "8-ball" | "8-ball-2v2" | "9-ball";
  race_to?: number;
  player_a?: string;
  player_b?: string;
  winner?: string;
  score?: string;
  opponent_id?: string | null;
  opponent_email?: string | null;
  status?: "pending" | "verified";
  balls_remaining?: number | null;
};

export async function POST(request: Request) {
  try {
    const access = await requireApprovedProfile(request);
    if (!access.ok) return access.response;

    const body = (await request.json()) as CreateGamePayload;
    const {
      date,
      table_name,
      format,
      race_to,
      player_a,
      player_b,
      winner,
      score,
      opponent_id,
      opponent_email,
      status,
      balls_remaining,
    } = body;

    if (!player_a || !player_b || !winner) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const insertPayload = {
      date: date || new Date().toISOString().slice(0, 10),
      table_name: table_name || "Table 1",
      format: format || "8-ball",
      race_to: race_to || 1,
      player_a,
      player_b,
      winner,
      score: score || "",
      user_id: access.userId,
      opponent_id: opponent_id || null,
      opponent_email: opponent_email || null,
      status: status || "pending",
      submitted_by: access.userId,
      balls_remaining: balls_remaining ?? null,
    };

    const { data, error } = await supabase
      .from("games")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    revalidateTag(CACHE_TAGS.games, "max");
    if (insertPayload.status === "verified") {
      revalidateTag(CACHE_TAGS.leaderboard, "max");
      revalidateTag(CACHE_TAGS.streaks, "max");
      revalidateTag(CACHE_TAGS.ratingHistory, "max");

      const is2v2 = insertPayload.format === "8-ball-2v2";
      const participants = [
        ...parseTeam(insertPayload.player_a, is2v2),
        ...parseTeam(insertPayload.player_b, is2v2),
      ];
      for (const name of new Set(participants)) {
        revalidateTag(profileTag(name), "max");
      }
    }

    if (insertPayload.opponent_id) {
      revalidateTag(userPendingTag(insertPayload.opponent_id), "max");
    }

    const response = NextResponse.json({ success: true, id: data.id });
    setRefreshedCookiesIfNeeded(response, access.refreshed);
    return response;
  } catch (error) {
    console.error("Error creating game:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
