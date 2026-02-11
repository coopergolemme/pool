import { getAuthUserFromRequest, setAuthCookies } from "@/lib/supabase/server-auth";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapGame, type DbGame } from "@/lib/types";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(request: Request) {
  try {
    const { user, refreshed } = await getAuthUserFromRequest(request);
    const userId = user?.id;
    const { searchParams } = new URL(request.url);
    const adminMode = searchParams.get("scope") === "admin";

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const supabase = createAdminClient();
    let query = supabase
      .from("games")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (adminMode) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (profile?.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
        );
      }
    } else {
      query = query.eq("opponent_id", userId).neq("submitted_by", userId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const games = (data ?? []).map((row) => mapGame(row as DbGame));
    const response = NextResponse.json({ games }, { headers: PRIVATE_NO_STORE_HEADERS });
    if (refreshed) {
      setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
    }
    return response;
  } catch (error) {
    console.error("Error fetching pending games:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
