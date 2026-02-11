import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromRequest, setAuthCookies } from "@/lib/supabase/server-auth";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(request: Request) {
  try {
    const { user, refreshed } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, email")
      .not("username", "is", null)
      .order("username", { ascending: true });

    if (error) {
      throw error;
    }

    const response = NextResponse.json(
      { profiles: data ?? [] },
      { headers: PRIVATE_NO_STORE_HEADERS },
    );
    if (refreshed) {
      setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
    }

    return response;
  } catch (error) {
    console.error("Error fetching profiles:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
