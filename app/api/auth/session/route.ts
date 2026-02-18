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
      const response = NextResponse.json({ user: null }, { headers: PRIVATE_NO_STORE_HEADERS });
      clearAuthCookies(response);
      return response;
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, username, email, role, approved")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.approved) {
      const response = NextResponse.json(
        { user: null, error: "Your account is pending admin approval." },
        { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
      );
      clearAuthCookies(response);
      return response;
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      profile: profile ?? null,
    }, { headers: PRIVATE_NO_STORE_HEADERS });

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
