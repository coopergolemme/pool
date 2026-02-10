import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromRequest, setAuthCookies } from "@/lib/supabase/server-auth";

export async function GET(request: Request) {
  try {
    const { user, refreshed } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const response = NextResponse.json({ profiles: data ?? [] });
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
