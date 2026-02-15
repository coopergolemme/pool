import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromRequest, setAuthCookies, clearAuthCookies } from "@/lib/supabase/server-auth";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(request: Request) {
  try {
    const { user, refreshed } = await getAuthUserFromRequest(request);

    if (!user) {
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
      );
      clearAuthCookies(response);
      return response;
    }

    const supabase = createAdminClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, rating, rd, wins, losses, streak")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

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

    if (refreshed) {
      setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
    }

    return response;
  } catch (error) {
    console.error("Error fetching current user stats:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
