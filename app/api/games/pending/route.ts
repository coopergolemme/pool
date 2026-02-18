import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapGame, type DbGame } from "@/lib/types";
import { unstable_cache } from "next/cache";
import { userPendingTag } from "@/lib/cache-tags";
import { requireApprovedProfile, setRefreshedCookiesIfNeeded } from "@/lib/auth/require-approved-profile";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(request: Request) {
  try {
    const access = await requireApprovedProfile(request);
    if (!access.ok) return access.response;

    const userId = access.userId;
    const { searchParams } = new URL(request.url);
    const adminMode = searchParams.get("scope") === "admin";

    const supabase = createAdminClient();
    let gamesData: DbGame[];

    if (adminMode) {
      if (access.profile.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
        );
      }

      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      gamesData = (data ?? []) as DbGame[];
    } else {
      const getPending = unstable_cache(
        async (uid: string) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("games")
            .select("*")
            .eq("status", "pending")
            .eq("opponent_id", uid)
            .neq("submitted_by", uid)
            .order("created_at", { ascending: false });
          
          if (error) throw error;
          return (data ?? []) as DbGame[];
        },
        [`pending-games-${userId}`],
        { revalidate: 60, tags: [userPendingTag(userId)] }
      );
      gamesData = await getPending(userId);
    }

    const games = gamesData.map(mapGame);
    const response = NextResponse.json({ games }, { headers: PRIVATE_NO_STORE_HEADERS });
    setRefreshedCookiesIfNeeded(response, access.refreshed);
    return response;
  } catch (error) {
    console.error("Error fetching pending games:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
