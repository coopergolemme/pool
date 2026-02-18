import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setRefreshedCookiesIfNeeded, requireApprovedProfile } from "@/lib/auth/require-approved-profile";
import { unstable_cache } from "next/cache";
import { userStatsTag } from "@/lib/cache-tags";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(request: Request) {
  try {
    const access = await requireApprovedProfile(request);
    if (!access.ok) return access.response;

    const getStats = unstable_cache(
      async (userId: string) => {
        const supabase = createAdminClient();
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, username, rating, rd, wins, losses, streak")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;
        return profile;
      },
      [`stats-${access.userId}`],
      { revalidate: 60, tags: [userStatsTag(access.userId)] }
    );

    const profile = await getStats(access.userId);

    const response = NextResponse.json({
      stats: profile
        ? {
            id: profile.id,
            username: profile.username,
            rating: Number(profile.rating ?? 1500),
            rd: Number(profile.rd ?? 350),
            wins: profile.wins ?? 0,
            losses: profile.losses ?? 0,
            streak: profile.streak ?? 0,
          }
        : null,
    }, { headers: PRIVATE_NO_STORE_HEADERS });

    setRefreshedCookiesIfNeeded(response, access.refreshed);

    return response;
  } catch (error) {
    console.error("Error fetching current user stats:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
