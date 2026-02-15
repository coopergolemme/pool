import { createClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env for server auth client");
}

const ACCESS_COOKIE = "pool-access-token";
const REFRESH_COOKIE = "pool-refresh-token";

export type AuthUser = User;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export const createServerAuthClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

export const readAuthCookies = (request: Request) => {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookiePairs = cookieHeader.split(";").map((part) => part.trim());

  const accessToken = cookiePairs
    .find((pair) => pair.startsWith(`${ACCESS_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  const refreshToken = cookiePairs
    .find((pair) => pair.startsWith(`${REFRESH_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  return { accessToken, refreshToken };
};

export const setAuthCookies = (
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
) => {
  response.cookies.set(ACCESS_COOKIE, accessToken, COOKIE_OPTIONS);
  response.cookies.set(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
};

export const clearAuthCookies = (response: NextResponse) => {
  response.cookies.set(ACCESS_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
};

export const getAuthUserFromRequest = async (request: Request) => {
  const { accessToken, refreshToken } = readAuthCookies(request);

  if (!accessToken) {
    return { user: null as AuthUser | null, refreshed: null as null | { accessToken: string; refreshToken: string } };
  }

  const supabase = createServerAuthClient();
  const { data: userData, error } = await supabase.auth.getUser(accessToken);

  if (!error && userData.user) {
    return { user: userData.user, refreshed: null };
  }

  if (!refreshToken) {
    return { user: null, refreshed: null };
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (refreshError || !refreshed.session?.access_token || !refreshed.session?.refresh_token || !refreshed.user) {
    return { user: null, refreshed: null };
  }

  return {
    user: refreshed.user,
    refreshed: {
      accessToken: refreshed.session.access_token,
      refreshToken: refreshed.session.refresh_token,
    },
  };
};
