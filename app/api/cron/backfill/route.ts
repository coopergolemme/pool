import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRatingsBackfill } from "@/lib/backfill-ratings";
import { getAuthUserFromRequest, setAuthCookies } from "@/lib/supabase/server-auth";

export const dynamic = 'force-dynamic'; // Ensure this function is not cached

export async function GET(request: Request) {
  const supabase = createAdminClient();

  // Auth Option 1: Vercel Cron Secret
  const authHeader = request.headers.get("authorization");
  const isCronSecretValid = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  // Auth Option 2: Signed-in admin (manual trigger from UI)
  let refreshedTokens: null | { accessToken: string; refreshToken: string } = null;
  if (!isCronSecretValid) {
    const { user, refreshed } = await getAuthUserFromRequest(request);
    refreshedTokens = refreshed;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: "Failed to verify admin role" }, { status: 500 });
    }

    if (profile?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    console.log("Starting nightly rating + rating history backfill...");
    const result = await runRatingsBackfill(supabase);

    const response = NextResponse.json({
      success: true,
      message: `Processed ${result.gamesProcessed} games, updated ${result.profilesUpdated} profiles, and upserted ${result.ratingChangesUpserted} rating history rows.`,
      ...result,
    });

    if (refreshedTokens) {
      setAuthCookies(response, refreshedTokens.accessToken, refreshedTokens.refreshToken);
    }

    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Backfill error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
