import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearAuthCookies,
  getAuthUserFromRequest,
  setAuthCookies,
} from "@/lib/supabase/server-auth";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export type AppProfile = {
  id: string;
  email: string;
  username: string | null;
  role: "USER" | "ADMIN";
  approved: boolean;
};

export type ApprovedProfileResult =
  | {
      ok: true;
      userId: string;
      profile: AppProfile;
      refreshed: null | { accessToken: string; refreshToken: string };
    }
  | {
      ok: false;
      response: NextResponse;
    };

type RequireApprovedProfileOptions = {
  requireAdmin?: boolean;
};

export async function requireApprovedProfile(
  request: Request,
  options: RequireApprovedProfileOptions = {},
): Promise<ApprovedProfileResult> {
  const { user, refreshed } = await getAuthUserFromRequest(request);
  if (!user) {
    const response = NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
    clearAuthCookies(response);
    return { ok: false, response };
  }

  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, username, role, approved")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile || !profile.approved) {
    const response = NextResponse.json(
      { error: "Your account is pending admin approval." },
      { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
    );
    clearAuthCookies(response);
    return { ok: false, response };
  }

  if (options.requireAdmin && profile.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
      ),
    };
  }

  return {
    ok: true,
    userId: user.id,
    profile: {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      role: profile.role,
      approved: Boolean(profile.approved),
    },
    refreshed,
  };
}

export function setRefreshedCookiesIfNeeded(
  response: NextResponse,
  refreshed: null | { accessToken: string; refreshToken: string },
) {
  if (!refreshed) return;
  setAuthCookies(response, refreshed.accessToken, refreshed.refreshToken);
}
