import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

const DEFAULT_MIN_STREAK = 3;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minParam = searchParams.get("min");
    const limitParam = searchParams.get("limit");

    const min = minParam ? Number.parseInt(minParam, 10) : DEFAULT_MIN_STREAK;
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT;

    if (Number.isNaN(min)) {
      return NextResponse.json({ error: "Invalid min value" }, { status: 400 });
    }
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      return NextResponse.json({ error: "Invalid limit value" }, { status: 400 });
    }

    const limit = Math.min(parsedLimit, MAX_LIMIT);
    const getStreaks = unstable_cache(
      async (requestedMin: number, requestedLimit: number) => {
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, streak")
          .not("username", "is", null)
          .gte("streak", requestedMin)
          .order("streak", { ascending: false })
          .order("username", { ascending: true })
          .limit(requestedLimit);

        if (error) throw error;

        return (data ?? []).map((row) => ({
          id: row.id,
          username: row.username as string,
          streak: row.streak ?? 0,
        }));
      },
      ["api-streaks"],
      { revalidate: 60, tags: [CACHE_TAGS.streaks, CACHE_TAGS.profiles] },
    );

    const leaders = await getStreaks(min, limit);

    return NextResponse.json(
      { leaders },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching streak leaders:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
