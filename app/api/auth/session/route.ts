import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserFromRequest, setAuthCookies, clearAuthCookies } from "@/lib/supabase/server-auth";

export async function GET(request: Request) {
  try {
    const { user, refreshed } = await getAuthUserFromRequest(request);

    if (!user) {
      const response = NextResponse.json({ user: null });
      clearAuthCookies(response);
      return response;
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, username, email, role")
      .eq("id", user.id)
      .maybeSingle();

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile: profile ?? null,
    });

    if (refreshed) {
      setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
    }

    return response;
  } catch (error) {
    console.error("Error in auth/session route:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
