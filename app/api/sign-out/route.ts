import { NextResponse } from "next/server";
import { clearAuthCookies, getAuthUserFromRequest } from "@/lib/supabase/server-auth";

export async function POST(request: Request) {
  const { user } = await getAuthUserFromRequest(request);
  const response = NextResponse.json({ success: true, hadSession: Boolean(user) });
  clearAuthCookies(response);
  return response;
}
