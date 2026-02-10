import { getAuthUserFromRequest, setAuthCookies } from "@/lib/supabase/server-auth";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapGame, type DbGame } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { user, refreshed } = await getAuthUserFromRequest(request);
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("status", "pending")
      .eq("opponent_id", userId)
      .neq("submitted_by", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const games = (data ?? []).map((row) => mapGame(row as DbGame));
    const response = NextResponse.json({ games });
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
